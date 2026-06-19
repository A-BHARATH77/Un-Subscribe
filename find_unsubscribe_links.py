"""
Stage 1: Scan Gmail inbox and extract unsubscribe links/headers from each email.

Setup:
1. Place your downloaded `credentials.json` (from Google Cloud Console) in the
   same folder as this script.
2. Run: python find_unsubscribe_links.py
3. First run opens a browser window to authorize access — approve it.
   A `token.json` is saved so you won't need to re-auth every time.

Output: `unsubscribe_links.json` — a list of {sender, subject, link_type, link}
"""

import base64
import json
import os
import re
from email import message_from_bytes
from email.utils import parseaddr

from bs4 import BeautifulSoup
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
MAX_RESULTS = 50  # how many recent emails to scan per run


def get_gmail_service():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token_file:
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
    urls = re.findall(r"<(https?://[^>]+)>", raw)
    mailtos = re.findall(r"<mailto:([^>]+)>", raw)
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


def extract_footer_unsubscribe_link(html):
    """Fallback: scan the HTML body for an anchor tag containing 'unsubscribe'."""
    if not html:
        return None
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        text = a.get_text(strip=True).lower()
        href = a["href"]
        if "unsubscribe" in text or "unsubscribe" in href.lower():
            return href
    return None


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
        }

        header_data = extract_list_unsubscribe(headers)
        if header_data:
            entry["list_unsubscribe_header"] = header_data

        if not header_data or not header_data.get("https_links"):
            html_body = get_email_html_body(msg["payload"])
            footer_link = extract_footer_unsubscribe_link(html_body)
            if footer_link:
                entry["footer_link"] = footer_link

        if entry["list_unsubscribe_header"] or entry["footer_link"]:
            results.append(entry)
            print(f"Found unsubscribe path: {sender} -> {subject}")

    with open("unsubscribe_links.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. {len(results)} emails with unsubscribe links saved to unsubscribe_links.json")


if __name__ == "__main__":
    main()