import os
import json
import base64
import re
import hashlib
import secrets
import logging
import threading
import time
from datetime import datetime
from flask import Flask, redirect, url_for, session, request, jsonify, Response, stream_with_context
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import unsubscribe_engine
import requests as http_requests

def _load_env_file(path: str) -> None:
    """Parse a .env file and inject keys into os.environ (stdlib only, no dotenv needed)."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass  # no .env file — rely on shell env vars

_load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)
logging.getLogger("unsubscribe_engine").setLevel(logging.INFO)

app = Flask(__name__)

# ── Supabase config ───────────────────────────────────────────────────────────
# Read from environment (set in .env or shell). The publishable key is safe to
# use server-side for inserting rows via the REST API.
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")

# ── Persistent secret key ────────────────────────────────────────────────────
# On Render: set FLASK_SECRET_KEY env var (disk is ephemeral).
# Locally: generated once and saved to .secret_key file.
SECRET_KEY_FILE = os.path.join(os.path.dirname(__file__), ".secret_key")
_env_secret = os.environ.get("FLASK_SECRET_KEY", "").strip()
if _env_secret:
    app.secret_key = _env_secret.encode()
elif os.path.exists(SECRET_KEY_FILE):
    with open(SECRET_KEY_FILE, "rb") as f:
        app.secret_key = f.read()
else:
    app.secret_key = secrets.token_bytes(32)
    with open(SECRET_KEY_FILE, "wb") as f:
        f.write(app.secret_key)

# ── Token persistence ────────────────────────────────────────────────────────
# OAuth token is saved to token.json locally.
# On Render (ephemeral disk) it is stored in the TOKEN_JSON env variable.
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")

# ── OAuth transport ───────────────────────────────────────────────────────────
# Allow HTTP only in local development; Render always uses HTTPS.
_on_render = bool(os.environ.get("RENDER"))
if not _on_render:
    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
# Don't raise an error if Google returns extra scopes in the token response
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# credentials.json path — on Render, written from GOOGLE_CREDENTIALS env var
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
if _on_render:
    _creds_env = os.environ.get("GOOGLE_CREDENTIALS", "")
    if _creds_env and not os.path.exists(CREDENTIALS_FILE):
        with open(CREDENTIALS_FILE, "w") as _f:
            _f.write(_creds_env)

# Temporary file that holds state + code_verifier across the OAuth redirect
OAUTH_STATE_FILE = os.path.join(os.path.dirname(__file__), ".oauth_state.json")


def save_token(creds_dict):
    """Write token dict to disk and sync to TOKEN_JSON env var for Render."""
    with open(TOKEN_FILE, "w") as f:
        json.dump(creds_dict, f)
    # Keep the env var in sync so other processes (e.g. background thread) see it
    os.environ["TOKEN_JSON"] = json.dumps(creds_dict)


def load_token():
    """
    Read token dict. Priority:
      1. TOKEN_JSON environment variable  (Render / ephemeral disk)
      2. token.json file on disk          (local development)
    """
    env_token = os.environ.get("TOKEN_JSON", "").strip()
    if env_token:
        try:
            return json.loads(env_token)
        except Exception:
            pass
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r") as f:
            return json.load(f)
    return None


def get_gmail_service():
    """Build and return an authenticated Gmail service.
    Falls back to the token.json file if the session has no credentials.
    Wipes stale tokens that were granted with an insufficient scope.
    """
    creds_data = session.get("credentials") or load_token()
    if not creds_data:
        return None

    # If saved token doesn't include the modify scope, force re-auth
    saved_scopes = creds_data.get("scopes") or []
    if isinstance(saved_scopes, str):
        saved_scopes = saved_scopes.split()
    needs_modify = any("modify" in s or "gmail" == s.rstrip("/").split("/")[-1]
                       for s in saved_scopes)
    readonly_only = all("readonly" in s for s in saved_scopes if "gmail" in s)
    if readonly_only:
        # Stale read-only token — clear everything and demand re-auth
        session.pop("credentials", None)
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
        return None

    # Populate session so subsequent requests don't re-read the file
    if "credentials" not in session:
        session["credentials"] = creds_data

    creds = Credentials(
        token=creds_data["token"],
        refresh_token=creds_data["refresh_token"],
        token_uri=creds_data["token_uri"],
        client_id=creds_data["client_id"],
        client_secret=creds_data["client_secret"],
        scopes=creds_data["scopes"],
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        updated = credentials_to_dict(creds)
        session["credentials"] = updated
        save_token(updated)
    return build("gmail", "v1", credentials=creds)


def credentials_to_dict(creds):
    return {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes,
    }


def decode_body(payload):
    """Decode email body from base64url."""
    if "body" in payload and payload["body"].get("data"):
        data = payload["body"]["data"]
        return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/html":
                data = part.get("body", {}).get("data", "")
                if data:
                    return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    text = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
                    return f"<pre style='white-space:pre-wrap;font-family:inherit'>{text}</pre>"
            # Recurse into nested parts
            result = decode_body(part)
            if result:
                return result
    return "<p><em>No content available.</em></p>"


def parse_headers(headers):
    """Extract useful headers from email."""
    result = {}
    for header in headers:
        name = header["name"].lower()
        if name in ("from", "to", "subject", "date", "cc", "bcc"):
            result[name] = header["value"]
    return result


def format_date(date_str):
    """Format email date string nicely."""
    if not date_str:
        return ""
    try:
        # Try common email date formats
        for fmt in [
            "%a, %d %b %Y %H:%M:%S %z",
            "%d %b %Y %H:%M:%S %z",
            "%a, %d %b %Y %H:%M:%S %Z",
        ]:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                now = datetime.now(dt.tzinfo)
                diff = now - dt
                if diff.days == 0:
                    return dt.strftime("%I:%M %p")
                elif diff.days < 7:
                    return dt.strftime("%a %I:%M %p")
                elif dt.year == now.year:
                    return dt.strftime("%b %d")
                else:
                    return dt.strftime("%b %d, %Y")
            except ValueError:
                continue
    except Exception:
        pass
    return date_str[:16] if len(date_str) > 16 else date_str


def get_sender_name(from_header):
    """Extract display name from From header."""
    if not from_header:
        return "Unknown"
    match = re.match(r'^"?([^"<]+)"?\s*<', from_header)
    if match:
        return match.group(1).strip()
    match = re.match(r'^([^@\s]+)@', from_header)
    if match:
        return match.group(1)
    return from_header.split("@")[0] if "@" in from_header else from_header


def get_sender_initials(name):
    """Get initials from name."""
    parts = name.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper() if name else "?"


@app.route("/")
def index():
    """Health-check / status endpoint. The UI is served by the Next.js frontend."""
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    return jsonify({
        "status": "ok",
        "message": "UnSub API server is running. UI is at the frontend URL.",
        "frontend": frontend_url,
    })


@app.route("/authorize")
def authorize():
    # Generate PKCE pair
    code_verifier = secrets.token_urlsafe(96)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("ascii")).digest()
    ).rstrip(b"=").decode("ascii")

    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        redirect_uri=url_for("oauth2callback", _external=True),
    )
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    # Persist state + verifier to disk — session cookies can be lost during redirect
    with open(OAUTH_STATE_FILE, "w") as f:
        json.dump({"state": state, "code_verifier": code_verifier}, f)
    return redirect(authorization_url)


@app.route("/oauth2callback")
def oauth2callback():
    # Load state and verifier from the file we wrote in /authorize
    oauth_data = {}
    if os.path.exists(OAUTH_STATE_FILE):
        with open(OAUTH_STATE_FILE, "r") as f:
            oauth_data = json.load(f)
        os.remove(OAUTH_STATE_FILE)   # one-time use

    state = oauth_data.get("state") or request.args.get("state")
    code_verifier = oauth_data.get("code_verifier")

    flow = Flow.from_client_secrets_file(
        CREDENTIALS_FILE,
        scopes=SCOPES,
        state=state,
        redirect_uri=url_for("oauth2callback", _external=True),
    )
    flow.fetch_token(
        authorization_response=request.url,
        code_verifier=code_verifier,
    )
    creds = flow.credentials
    creds_dict = credentials_to_dict(creds)
    session["credentials"] = creds_dict
    save_token(creds_dict)
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    return redirect(f"{frontend_url}/inbox")




@app.route("/api/email/<msg_id>")
def api_get_email(msg_id):
    """JSON endpoint: return full email data for the frontend detail page."""
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        msg_data = service.users().messages().get(
            userId="me", id=msg_id, format="full"
        ).execute()
        headers = parse_headers(msg_data.get("payload", {}).get("headers", []))
        body = decode_body(msg_data.get("payload", {}))
        label_ids = msg_data.get("labelIds", [])
        is_unread = "UNREAD" in label_ids
        is_starred = "STARRED" in label_ids

        # Mark as read
        if is_unread:
            service.users().messages().modify(
                userId="me",
                id=msg_id,
                body={"removeLabelIds": ["UNREAD"]}
            ).execute()

        sender_name = get_sender_name(headers.get("from", ""))
        profile = service.users().getProfile(userId="me").execute()
        user_email = profile.get("emailAddress", "")

        return jsonify({
            "id": msg_id,
            "from": headers.get("from", ""),
            "sender_name": sender_name,
            "initials": get_sender_initials(sender_name),
            "to": headers.get("to", ""),
            "cc": headers.get("cc", ""),
            "subject": headers.get("subject", "(no subject)"),
            "date": headers.get("date", ""),
            "body": body,
            "is_starred": is_starred,
            "user_email": user_email,
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/unread-ids")
def api_unread_ids():
    """Return a list of unread INBOX message IDs (lightweight, for automation)."""
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        result = service.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD"], maxResults=50
        ).execute()
        ids = [m["id"] for m in result.get("messages", [])]
        return jsonify({"ids": ids})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/api/me")
def api_me():
    """Return the authenticated user's profile (email + initials)."""
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        profile = service.users().getProfile(userId="me").execute()
        email = profile.get("emailAddress", "")
        name = get_sender_name(email)
        return jsonify({
            "email": email,
            "initials": get_sender_initials(name),
        })
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500



@app.route("/api/emails")
def api_emails():
    """AJAX endpoint for loading emails with label filter."""
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401
    label = request.args.get("label", "INBOX")
    query = request.args.get("q", "")
    result = service.users().messages().list(
        userId="me", labelIds=[label] if label else [],
        q=query, maxResults=30
    ).execute()
    messages = result.get("messages", [])
    emails = []
    for msg in messages:
        msg_data = service.users().messages().get(
            userId="me", id=msg["id"], format="metadata",
            metadataHeaders=["From", "Subject", "Date"]
        ).execute()
        headers = parse_headers(msg_data.get("payload", {}).get("headers", []))
        snippet = msg_data.get("snippet", "")
        label_ids = msg_data.get("labelIds", [])
        is_unread = "UNREAD" in label_ids
        is_starred = "STARRED" in label_ids
        sender_name = get_sender_name(headers.get("from", ""))
        emails.append({
            "id": msg["id"],
            "from": headers.get("from", ""),
            "sender_name": sender_name,
            "initials": get_sender_initials(sender_name),
            "subject": headers.get("subject", "(no subject)"),
            "date": format_date(headers.get("date", "")),
            "snippet": snippet,
            "is_unread": is_unread,
            "is_starred": is_starred,
        })
    return jsonify(emails)


# ── Unsubscribe helpers ─────────────────────────────────────────────────────

def _get_email_full(service, msg_id):
    """Fetch full email payload and return (html_body, list_unsub_header)."""
    msg_data = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()
    payload = msg_data.get("payload", {})
    headers_raw = payload.get("headers", [])

    # Extract List-Unsubscribe header
    list_unsub = None
    for h in headers_raw:
        if h["name"].lower() == "list-unsubscribe":
            list_unsub = h["value"]
            break

    html_body = decode_body(payload)
    return html_body, list_unsub


def _mark_as_read(service, msg_id: str) -> bool:
    """Remove the UNREAD label from an email. Returns True on success."""
    try:
        service.users().messages().modify(
            userId="me",
            id=msg_id,
            body={"removeLabelIds": ["UNREAD"]}
        ).execute()
        return True
    except Exception as exc:
        logger.warning("Could not mark msg %s as read: %s", msg_id, exc)
        return False


def _get_user_email(service) -> str:
    """Fetch the authenticated user's Gmail address."""
    try:
        profile = service.users().getProfile(userId="me").execute()
        return profile.get("emailAddress", "")
    except Exception as exc:
        logger.warning("Could not fetch user email: %s", exc)
        return ""


def _store_result_in_db(service, msg_id: str, result: dict) -> bool:
    """
    Store the unsubscribe result in Supabase.
    Inserts a row with: sender_email, sender_name, result (status), created_at.
    Fires regardless of success/failure status so every processed email is logged.
    Returns True if the insert succeeded.
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.warning("[DB] Supabase URL or key not configured — skipping DB store.")
        return False

    try:
        # Fetch full email so we can check the body for forwarded messages
        msg_data = service.users().messages().get(
            userId="me", id=msg_id, format="full"
        ).execute()
        
        payload_data = msg_data.get("payload", {})

        from_raw = ""
        to_raw = ""
        # 1. Fallback to normal headers first
        for h in payload_data.get("headers", []):
            if h["name"].lower() == "from":
                from_raw = h["value"]
            elif h["name"].lower() == "to":
                to_raw = h["value"]
                
        # 2. Check if it's a forwarded message by looking at the email body
        try:
            from bs4 import BeautifulSoup
            from email.utils import parseaddr as _parseaddr
            html_content = decode_body(payload_data)

            # --- Extract forwarded From/To from the RAW HTML first ---
            # BeautifulSoup.get_text() strips <email@example.com> as if it were
            # an HTML tag, so we search the raw HTML source for the forwarded
            # header lines BEFORE any HTML stripping takes place.
            raw_fwd_match = re.search(
                r"-{3,}\s*Forwarded message\s*-{3,}(.+?)(?:<br\s*/?>|\n){5,}",
                html_content,
                re.IGNORECASE | re.DOTALL,
            )
            raw_block = raw_fwd_match.group(1) if raw_fwd_match else html_content

            # Strip inline HTML tags from the raw block (e.g. <b>, <span>)
            # but preserve angle-bracketed email addresses by temporarily
            # replacing < and > that wrap an email address.
            import html as _html_mod
            # Unescape HTML entities first (e.g. &lt; → <)
            raw_block_unescaped = _html_mod.unescape(raw_block)

            def _strip_html_tags(text):
                """Remove HTML tags but preserve <email@address> patterns.
                Block-level tags and <br> are converted to newlines first so
                that From:/To: lines are properly terminated."""
                # Convert line-break / block tags → newline so each header
                # field ends up on its own line
                text = re.sub(r"<br\s*/?>|</(?:p|div|tr|li|h[1-6]|blockquote)>",
                              "\n", text, flags=re.IGNORECASE)
                # Temporarily protect email addresses in angle brackets
                protected = re.sub(
                    r"<([^<>\s]+@[^<>\s]+)>",
                    r"[\1]",
                    text,
                )
                # Strip remaining HTML tags
                clean = re.sub(r"<[^>]+>", "", protected)
                # Restore protected email addresses
                clean = re.sub(r"\[([^\[\]]+@[^\[\]]+)\]", r"<\1>", clean)
                return clean

            raw_block_clean = _strip_html_tags(raw_block_unescaped)

            # Match "From: Priceline <email@deals.priceline.com>"
            fwd_from_match = re.search(r"From:\s*(.+?)(?:\r?\n|$)", raw_block_clean, re.IGNORECASE)
            if fwd_from_match:
                from_raw = fwd_from_match.group(1).strip()

            # Match "To: <bkalai2328@gmail.com>"
            fwd_to_match = re.search(r"To:\s*(.+?)(?:\r?\n|$)", raw_block_clean, re.IGNORECASE)
            if fwd_to_match:
                to_raw = fwd_to_match.group(1).strip()

            # If we still didn't find To: in raw HTML, fall back to plain-text
            # extraction (but use a regex that can capture bare email addresses too)
            if not to_raw:
                text_content = BeautifulSoup(html_content, "html.parser").get_text(separator="\n")
                fwd_block_text = re.search(
                    r"-{3,}\s*Forwarded message\s*-{3,}(.+)",
                    text_content,
                    re.IGNORECASE | re.DOTALL,
                )
                block = fwd_block_text.group(1) if fwd_block_text else text_content
                fwd_to_text = re.search(
                    r"To:\s*([\w._%+\-]+@[\w.\-]+\.[a-zA-Z]{2,})",
                    block,
                    re.IGNORECASE,
                )
                if fwd_to_text:
                    to_raw = fwd_to_text.group(1).strip()

        except Exception as e:
            logger.warning("[DB] Failed to parse forwarded body: %s", e)

        from email.utils import parseaddr

        # organization_name ← display name from the forwarded From: line
        #   e.g. "Priceline <email@deals.priceline.com>" → org_name = "Priceline"
        org_name, _from_email = parseaddr(from_raw)
        # If parseaddr couldn't find a display name, strip the email part and
        # use whatever text remains (e.g. "Priceline" from "Priceline <email@...>")
        if not org_name:
            org_name = re.sub(r"\s*<[^>]+>", "", from_raw).strip() or from_raw.strip()
        # Final guard: remove any trailing <email@...> that slipped through
        org_name = re.sub(r"\s*<[^>]+@[^>]+>", "", org_name).strip()

        # sender_email ← the email address from the forwarded To: line
        #   e.g. "<bkalai2328@gmail.com>" → to_email = "bkalai2328@gmail.com"
        _to_name, to_email = parseaddr(to_raw)
        # Strip any stray angle brackets in case parseaddr missed them
        to_email = to_email.strip("<>").strip()

        payload = {
            "organization_name": org_name,
            "sender_email":      to_email,
            "result":            result.get("status", "error"),
            "created_at":        datetime.utcnow().isoformat() + "Z",
        }

        resp = http_requests.post(
            f"{SUPABASE_URL}/rest/v1/unsubscribe_logs",
            json=payload,
            headers={
                "apikey":        SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Content-Type":  "application/json",
                "Prefer":        "return=minimal",
            },
            timeout=10,
        )
        if resp.status_code in (200, 201):
            logger.info("[DB] Stored result — org=%s to=%s (%s)", org_name, to_email, result.get("status"))
            return True
        else:
            logger.warning("[DB] Insert failed %s: %s", resp.status_code, resp.text)
            return False

    except Exception as exc:
        logger.warning("[DB] Could not store result for msg %s: %s", msg_id, exc)
        return False

@app.route("/api/unsubscribe/<msg_id>", methods=["POST"])
def api_unsubscribe_single(msg_id):
    """Unsubscribe from a single email by message ID."""
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        html_body, list_unsub = _get_email_full(service, msg_id)
        user_email = _get_user_email(service)
        result = unsubscribe_engine.run(html_body, list_unsub, user_email=user_email)

        # Mark as read on success; always store the result in DB
        marked_read = False
        db_stored   = False
        if result.get("status") == "success":
            marked_read = _mark_as_read(service, msg_id)
        db_stored = _store_result_in_db(service, msg_id, result)
        result["marked_read"] = marked_read
        result["db_stored"]   = db_stored

        return jsonify(result)
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 500


@app.route("/api/unsubscribe/all")
def api_unsubscribe_all():
    """
    Server-Sent Events stream that processes all unread emails one by one.
    Query param: ids=id1,id2,id3,...
    Each SSE event is a JSON object:
      { index, total, msg_id, subject, sender, status, method, reason, url }
    A final event with type 'done' is sent when all are processed.
    """
    service = get_gmail_service()
    if service is None:
        return jsonify({"error": "Not authenticated"}), 401

    raw_ids = request.args.get("ids", "")
    msg_ids = [i.strip() for i in raw_ids.split(",") if i.strip()]

    if not msg_ids:
        return jsonify({"error": "No email IDs provided"}), 400

    def generate():
        total = len(msg_ids)
        success_count = 0
        skipped_count = 0
        not_found_count = 0
        error_count = 0

        # Fetch user email once for Gemini fallback
        user_email = _get_user_email(service)

        for idx, msg_id in enumerate(msg_ids):
            # Fetch email metadata for display
            subject = "(unknown)"
            sender = "(unknown)"
            try:
                meta = service.users().messages().get(
                    userId="me", id=msg_id, format="metadata",
                    metadataHeaders=["Subject", "From", "List-Unsubscribe"]
                ).execute()
                for h in meta.get("payload", {}).get("headers", []):
                    if h["name"].lower() == "subject":
                        subject = h["value"]
                    elif h["name"].lower() == "from":
                        sender = get_sender_name(h["value"])
            except Exception:
                pass

            # Send a "processing" event so UI can show spinner for current email
            processing_event = json.dumps({
                "type": "processing",
                "index": idx,
                "total": total,
                "msg_id": msg_id,
                "subject": subject,
                "sender": sender,
            })
            yield f"data: {processing_event}\n\n"

            # Run the unsubscribe engine
            result = {"status": "error", "method": None, "reason": "Unknown", "url": None, "error": None}
            try:
                html_body, list_unsub = _get_email_full(service, msg_id)
                result = unsubscribe_engine.run(html_body, list_unsub, user_email=user_email)
            except Exception as exc:
                result = {
                    "status": "error", "method": None,
                    "reason": str(exc), "url": None, "error": str(exc)
                }

            # Tally + mark as read + store result in DB
            s = result.get("status", "error")
            if s == "success":
                success_count += 1
                result["marked_read"] = _mark_as_read(service, msg_id)
            else:
                result["marked_read"] = False
                if s == "skipped":     skipped_count += 1
                elif s == "not_found": not_found_count += 1
                else:                  error_count += 1
            result["db_stored"] = _store_result_in_db(service, msg_id, result)

            # Send result event
            result_event = json.dumps({
                "type": "result",
                "index": idx,
                "total": total,
                "msg_id": msg_id,
                "subject": subject,
                "sender": sender,
                **result,
            })
            yield f"data: {result_event}\n\n"

        # Final summary
        done_event = json.dumps({
            "type": "done",
            "total": total,
            "success": success_count,
            "skipped": skipped_count,
            "not_found": not_found_count,
            "errors": error_count,
        })
        yield f"data: {done_event}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/logout")
def logout():
    session.clear()
    # Remove saved token so the next visit requires fresh login
    if os.path.exists(TOKEN_FILE):
        os.remove(TOKEN_FILE)
    if os.path.exists(SECRET_KEY_FILE):
        os.remove(SECRET_KEY_FILE)
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    return redirect(frontend_url)


# ── Server-side background auto-unsubscribe scheduler ────────────────────────
# Runs independently of the browser UI. On every 2-minute cycle it:
#   1. Loads credentials from token.json (no active session required)
#   2. Fetches all unread INBOX messages
#   3. Skips any message IDs already processed in this session
#   4. Runs the unsubscribe engine on each new unread email

AUTO_INTERVAL_SECONDS = 120   # 2 minutes

_auto_state = {
    "running":       False,     # True while the scheduler loop is alive
    "last_run":      None,      # ISO timestamp of the last check
    "next_run":      None,      # ISO timestamp of the upcoming check
    "processed_ids": set(),     # IDs handled so far (avoids re-processing)
    "cycle_count":   0,         # How many polling cycles have completed
    "last_results":  [],        # Summary of the most-recent cycle
    "thread":        None,      # Background thread reference
}
_auto_state_lock = threading.Lock()


def _build_service_from_token():
    """Build a Gmail service purely from the saved token.json, no Flask session."""
    token_data = load_token()
    if not token_data:
        return None

    # Reject read-only tokens
    saved_scopes = token_data.get("scopes") or []
    if isinstance(saved_scopes, str):
        saved_scopes = saved_scopes.split()
    if all("readonly" in s for s in saved_scopes if "gmail" in s):
        logger.warning("[AutoUnsub] Token is read-only — skipping.")
        return None

    creds = Credentials(
        token=token_data["token"],
        refresh_token=token_data["refresh_token"],
        token_uri=token_data["token_uri"],
        client_id=token_data["client_id"],
        client_secret=token_data["client_secret"],
        scopes=token_data["scopes"],
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        save_token(credentials_to_dict(creds))
    return build("gmail", "v1", credentials=creds)


def _run_auto_cycle():
    """Execute one full unsubscribe cycle: fetch unread → unsub each new one."""
    logger.info("[AutoUnsub] Starting cycle #%d", _auto_state["cycle_count"] + 1)

    service = _build_service_from_token()
    if service is None:
        logger.info("[AutoUnsub] No valid credentials yet — skipping cycle.")
        return

    # Fetch unread inbox IDs
    try:
        result = service.users().messages().list(
            userId="me", labelIds=["INBOX", "UNREAD"], maxResults=50
        ).execute()
        all_ids = [m["id"] for m in result.get("messages", [])]
    except Exception as exc:
        logger.warning("[AutoUnsub] Failed to fetch unread IDs: %s", exc)
        return

    # Only process IDs we haven't touched yet
    with _auto_state_lock:
        new_ids = [i for i in all_ids if i not in _auto_state["processed_ids"]]

    if not new_ids:
        logger.info("[AutoUnsub] No new unread emails — inbox clean.")
        with _auto_state_lock:
            _auto_state["last_results"] = []
            _auto_state["cycle_count"] += 1
            _auto_state["last_run"] = datetime.now().isoformat()
        return

    logger.info("[AutoUnsub] %d new unread email(s) to process.", len(new_ids))
    user_email = ""
    try:
        profile = service.users().getProfile(userId="me").execute()
        user_email = profile.get("emailAddress", "")
    except Exception:
        pass

    cycle_results = []
    for msg_id in new_ids:
        # Fetch subject / sender for logging
        subject = "(unknown)"
        sender  = "(unknown)"
        try:
            meta = service.users().messages().get(
                userId="me", id=msg_id, format="metadata",
                metadataHeaders=["Subject", "From"]
            ).execute()
            for h in meta.get("payload", {}).get("headers", []):
                if h["name"].lower() == "subject":
                    subject = h["value"]
                elif h["name"].lower() == "from":
                    sender = get_sender_name(h["value"])
        except Exception:
            pass

        logger.info("[AutoUnsub] Processing: %s — %s", sender, subject)

        result = {"status": "error", "method": None, "reason": "Unknown", "url": None}
        try:
            html_body, list_unsub = _get_email_full(service, msg_id)
            result = unsubscribe_engine.run(html_body, list_unsub, user_email=user_email)
        except Exception as exc:
            result = {"status": "error", "method": None, "reason": str(exc), "url": None}

        # Always mark as read once we've attempted to process the email
        _mark_as_read(service, msg_id)
        # Store the result in DB for every processed email
        _store_result_in_db(service, msg_id, result)

        # Mark this ID as processed regardless of outcome so we don't retry endlessly
        with _auto_state_lock:
            _auto_state["processed_ids"].add(msg_id)

        cycle_results.append({
            "msg_id":  msg_id,
            "sender":  sender,
            "subject": subject,
            "status":  result.get("status"),
            "method":  result.get("method"),
            "reason":  result.get("reason"),
        })
        logger.info(
            "[AutoUnsub] %s → status=%s method=%s",
            sender, result.get("status"), result.get("method")
        )

    with _auto_state_lock:
        _auto_state["last_results"] = cycle_results
        _auto_state["cycle_count"] += 1
        _auto_state["last_run"] = datetime.now().isoformat()

    logger.info("[AutoUnsub] Cycle complete — %d email(s) processed.", len(new_ids))


def _auto_scheduler_loop():
    """Background thread: run a cycle immediately, then repeat every 2 minutes."""
    logger.info("[AutoUnsub] Background scheduler started (interval=%ds).", AUTO_INTERVAL_SECONDS)
    with _auto_state_lock:
        _auto_state["running"] = True

    while True:
        with _auto_state_lock:
            if not _auto_state["running"]:
                break

        # Set next_run timestamp before sleeping
        next_ts = datetime.fromtimestamp(
            time.time() + AUTO_INTERVAL_SECONDS
        ).isoformat()
        with _auto_state_lock:
            _auto_state["next_run"] = next_ts

        try:
            _run_auto_cycle()
        except Exception as exc:
            logger.exception("[AutoUnsub] Unexpected error in cycle: %s", exc)

        # Sleep in small increments so we can respond quickly to stop signals
        for _ in range(AUTO_INTERVAL_SECONDS * 2):   # 0.5-second ticks
            with _auto_state_lock:
                if not _auto_state["running"]:
                    break
            time.sleep(0.5)

    logger.info("[AutoUnsub] Background scheduler stopped.")


def start_auto_scheduler():
    """Spawn the background scheduler thread (idempotent)."""
    with _auto_state_lock:
        if _auto_state["running"] and _auto_state["thread"] and _auto_state["thread"].is_alive():
            logger.info("[AutoUnsub] Scheduler already running — skipping duplicate start.")
            return
        _auto_state["running"] = True

    t = threading.Thread(target=_auto_scheduler_loop, daemon=True, name="auto-unsub-scheduler")
    with _auto_state_lock:
        _auto_state["thread"] = t
    t.start()
    logger.info("[AutoUnsub] Scheduler thread launched.")


@app.route("/api/auto-status")
def api_auto_status():
    """Return the current state of the server-side auto-unsubscribe scheduler."""
    with _auto_state_lock:
        return jsonify({
            "running":      _auto_state["running"],
            "last_run":     _auto_state["last_run"],
            "next_run":     _auto_state["next_run"],
            "cycle_count":  _auto_state["cycle_count"],
            "processed":    len(_auto_state["processed_ids"]),
            "last_results": _auto_state["last_results"],
        })


if __name__ == "__main__":
    # Start the background scheduler automatically when the server boots.
    # It will check for unread emails immediately, then every 2 minutes.
    start_auto_scheduler()
    app.run(debug=True, port=5000, use_reloader=False)
