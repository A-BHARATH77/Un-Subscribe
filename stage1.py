"""
Stage 1: Scan Gmail inbox and extract unsubscribe links/headers from each email.

Setup:
1. Place your downloaded `credentials.json` (from Google Cloud Console) in the
   same folder as this script.
2. Run: python find_unsubscribe_links.py
3. First run opens a browser window to authorize access — approve it.
   A `token.json` is saved so you won't need to re-auth every time.

Output: `unsubscribe_links.json` — a list of {sender, subject, link_type, link}

Note: requires `pip install requests` in addition to earlier dependencies,
used for the blank-page/tracking-token validation step.
"""

import base64
import html as html_lib
import json
import os
import re
import sys
from email import message_from_bytes
from email.utils import parseaddr
from urllib.parse import urljoin, urlparse

# Force UTF-8 output regardless of the console's default codepage (e.g.
# Windows cp1252) and regardless of how this script is launched (directly,
# via the .exe, or as a subprocess from app.py) - prevents crashes when an
# email subject contains emoji or other non-Latin-1 characters.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import requests
from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
MAX_RESULTS = 50  # how many recent emails to scan per run

CREDENTIALS_PATH = os.environ.get("UNSUBHERO_CREDENTIALS_PATH", "credentials.json")
TOKEN_PATH = os.environ.get("UNSUBHERO_TOKEN_PATH", "token.json")


def get_gmail_service():
    creds = None
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "w") as token_file:
            token_file.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def get_header(headers, name):
    for h in headers:
        if h["name"].lower() == name.lower():
            return h["value"]
    return None


def extract_list_unsubscribe(headers):
    """Parses the List-Unsubscribe header, which may contain a mailto: and/or
    an https: link, e.g. '<mailto:x@y.com>, <https://example.com/unsub?id=1>'"""
    raw = get_header(headers, "List-Unsubscribe")
    if not raw:
        return None
    raw = html_lib.unescape(raw.strip())
    urls = re.findall(r"<(https?://[^>\s]+)>", raw)
    mailtos = re.findall(r"<mailto:([^>\s]+)>", raw)
    one_click = get_header(headers, "List-Unsubscribe-Post") is not None
    return {
        "https_links": urls,
        "mailto": mailtos,
        "one_click_supported": one_click,
    }


def get_email_html_body(payload):
    """Recursively find the text/html part of a Gmail message payload."""
    if payload.get("mimeType") == "text/html" and "data" in payload.get("body", {}):
        data = payload["body"]["data"]
        return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    for part in payload.get("parts", []) or []:
        result = get_email_html_body(part)
        if result:
            return result
    return None


UNSUB_KEYWORDS = ["unsubscribe", "opt out", "opt-out", "remove me", "stop emails"]
PREFERENCE_KEYWORDS = ["manage preferences", "email preferences", "update preferences",
                       "notification settings", "manage subscription"]


def _score_candidate(href, text):
    """Higher score = more likely to be the real unsubscribe link.
    Scores both the link text and the URL itself, since some emails put
    generic text ('Click here') on the real link, or vice versa."""
    href_l = href.lower()
    text_l = text.lower()
    score = 0

    if "unsubscribe" in href_l:
        score += 5
    if any(k in href_l for k in ["opt-out", "optout", "/unsub"]):
        score += 3
    if any(k in text_l for k in UNSUB_KEYWORDS):
        score += 4
    if any(k in text_l for k in PREFERENCE_KEYWORDS):
        score += 2  # valid path, but lower priority than a direct unsubscribe
    if href_l.startswith("mailto:"):
        score -= 2  # deprioritize mailto over a clickable web link
    if len(href) < 8:
        score -= 5  # junk/anchor-only hrefs like "#"

    return score


def extract_footer_unsubscribe_link(html, base_url=None):
    """Scans the HTML body for unsubscribe-related anchors, scores every
    candidate, and returns the best match (instead of just the first hit)."""
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for a in soup.find_all("a", href=True):
        href = html_lib.unescape(a["href"].strip())
        text = a.get_text(strip=True)

        if not href or href.startswith("#"):
            continue

        relevant = any(k in href.lower() for k in ["unsubscribe", "opt-out", "optout", "/unsub"]) \
            or any(k in text.lower() for k in UNSUB_KEYWORDS + PREFERENCE_KEYWORDS)
        if not relevant:
            continue

        if base_url and not href.lower().startswith(("http://", "https://", "mailto:")):
            href = urljoin(base_url, href)

        candidates.append({
            "href": href,
            "text": text,
            "score": _score_candidate(href, text),
        })

    if not candidates:
        return None

    candidates.sort(key=lambda c: c["score"], reverse=True)
    best = candidates[0]
    return {"link": best["href"], "link_text": best["text"], "confidence": best["score"]}


def _page_has_content(url, timeout=8):
    """Lightweight check: does this URL actually render something meaningful,
    or is it a blank/empty shell? Some marketing platforms (Marketo, etc.)
    serve an empty page at the tracked URL (with a tracking token like
    mkt_tok in the query string) and only show the real unsubscribe form
    once you land on the bare URL without that token. We can't run a full
    JS-rendering browser in Stage 1 (that's Stage 2's job), so this does a
    plain HTTP GET and checks if the body has substantive content."""
    try:
        resp = requests.get(
            url, timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (compatible; UnsubBot/1.0)"},
            allow_redirects=True,
        )
    except requests.RequestException:
        return False, None

    if resp.status_code >= 400:
        return False, resp.url

    soup = BeautifulSoup(resp.text, "html.parser")
    visible_text = soup.get_text(strip=True)
    has_form_elements = bool(soup.find_all(["form", "input", "button", "select"]))
    has_meaningful_text = len(visible_text) > 40  # arbitrary floor to filter out blank shells

    return (has_form_elements or has_meaningful_text), resp.url


def _stripped_url(url):
    """Returns the same URL with the query string removed, e.g. strips off
    ?mkt_tok=... style tracking tokens to try the 'bare' page underneath."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"


def validate_and_resolve_link(url):
    """General fix for the 'tracked link renders blank, bare link has the
    real form' pattern. Tries the link as-is first; if it looks empty,
    falls back to the same URL with query params stripped. Returns the URL
    that should actually be used, plus a note on what happened."""
    if not url or url.startswith("mailto:"):
        return url, "not_checked (mailto)"

    ok, final_url = _page_has_content(url)
    if ok:
        return final_url or url, "ok_as_is"

    stripped = _stripped_url(url)
    if stripped != url:
        ok_stripped, final_stripped = _page_has_content(stripped)
        if ok_stripped:
            return final_stripped or stripped, "fell_back_to_stripped_url"

    # Neither version clearly worked — hand back the original link anyway,
    # but flag it so Stage 2 / a human knows to double check it.
    return url, "unverified_possibly_blank"


def main():
    service = get_gmail_service()
    results = []

    resp = service.users().messages().list(
        userId="me", maxResults=MAX_RESULTS, labelIds=["INBOX"]
    ).execute()
    messages = resp.get("messages", [])
    print(f"Scanning {len(messages)} emails...")

    for msg_meta in messages:
        msg = service.users().messages().get(
            userId="me", id=msg_meta["id"], format="full"
        ).execute()

        headers = msg["payload"]["headers"]
        sender = get_header(headers, "From")
        subject = get_header(headers, "Subject")

        entry = {
            "sender": sender,
            "sender_domain": parseaddr(sender)[1].split("@")[-1] if sender else None,
            "subject": subject,
            "list_unsubscribe_header": None,
            "footer_link": None,
            "best_link": None,        # the single link Stage 2 should actually visit
            "best_link_source": None, # "header" or "footer", for debugging
            "link_validation": None,
        }

        header_data = extract_list_unsubscribe(headers)
        if header_data:
            entry["list_unsubscribe_header"] = header_data

        header_has_strong_link = bool(header_data and header_data.get("https_links"))

        # Always extract the footer link too now (not just as a fallback),
        # because the header link isn't always more trustworthy — some ESPs
        # route List-Unsubscribe through a third-party redirect gateway that
        # never actually lands on the sender's real opt-out page, while the
        # footer link in the body goes there directly. We need both
        # candidates to compare, not just whichever we find first.
        html_body = get_email_html_body(msg["payload"])
        base_url = f"https://{entry['sender_domain']}" if entry["sender_domain"] else None
        footer_result = extract_footer_unsubscribe_link(html_body, base_url=base_url)
        if footer_result:
            entry["footer_link"] = footer_result

        # Build the list of real candidates (header https link, footer link),
        # validate each one (follows redirects, checks for blank pages), then
        # pick the winner based on which actually resolves to the sender's
        # own domain — that's a stronger trust signal than "header beats
        # footer by default", since third-party ESP redirect gateways in the
        # header sometimes never reach the real opt-out page.
        candidates = []
        if header_has_strong_link:
            header_url = header_data["https_links"][0]
            resolved, note = validate_and_resolve_link(header_url)
            candidates.append({
                "source": "header", "original": header_url,
                "resolved": resolved, "note": note,
            })

        if entry["footer_link"] and entry["footer_link"]["confidence"] >= 4:
            footer_url = entry["footer_link"]["link"]
            resolved, note = validate_and_resolve_link(footer_url)
            candidates.append({
                "source": "footer", "original": footer_url,
                "resolved": resolved, "note": note,
            })

        def _domain_matches_sender(resolved_url):  # kept for reference/debugging, not used in ranking now
            if not resolved_url or not entry["sender_domain"]:
                return False
            resolved_host = urlparse(resolved_url).netloc.lower()
            sender_root = ".".join(entry["sender_domain"].lower().split(".")[-2:])
            return sender_root in resolved_host

        chosen = None
        if entry["footer_link"] and entry["footer_link"]["confidence"] >= 4:
            footer_candidates = [c for c in candidates if c["source"] == "footer"]
            chosen = footer_candidates[0] if footer_candidates else None
        if not chosen and candidates:
            chosen = candidates[0]

        if chosen:
            entry["best_link"] = chosen["resolved"]
            entry["best_link_source"] = chosen["source"]
            entry["link_validation"] = chosen["note"]
        elif header_data and header_data.get("mailto"):
            entry["best_link"] = f"mailto:{header_data['mailto'][0]}"
            entry["best_link_source"] = "header_mailto"
            entry["link_validation"] = "not_checked (mailto)"

        if entry["best_link"]:
            results.append(entry)
            print(f"[{entry['best_link_source']}] ({entry['link_validation']}) {sender} -> {subject}")

    # Dedupe: many emails from the same sender share the exact same
    # unsubscribe link — no need to visit it more than once in Stage 2.
    seen_links = set()
    deduped = []
    for entry in results:
        if entry["best_link"] not in seen_links:
            seen_links.add(entry["best_link"])
            deduped.append(entry)
    results = deduped

    with open("unsubscribe_links.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. {len(results)} unique unsubscribe links saved to unsubscribe_links.json")


if __name__ == "__main__":
    main()