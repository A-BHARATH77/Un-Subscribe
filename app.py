import os
import json
import base64
import re
import hashlib
import secrets
import logging
import threading
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from flask import Flask, redirect, url_for, session, request, render_template, jsonify, Response, stream_with_context
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import unsubscribe_engine

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)
logging.getLogger("unsubscribe_engine").setLevel(logging.INFO)

app = Flask(__name__)

# ── Persistent secret key ────────────────────────────────────────────────────
# Generated once and saved to disk so Flask session cookies survive restarts.
SECRET_KEY_FILE = os.path.join(os.path.dirname(__file__), ".secret_key")
if os.path.exists(SECRET_KEY_FILE):
    with open(SECRET_KEY_FILE, "rb") as f:
        app.secret_key = f.read()
else:
    app.secret_key = secrets.token_bytes(32)
    with open(SECRET_KEY_FILE, "wb") as f:
        f.write(app.secret_key)

# ── Token persistence ────────────────────────────────────────────────────────
# OAuth token is saved to token.json so the user stays logged in across
# server restarts without having to go through Google's consent screen again.
TOKEN_FILE = os.path.join(os.path.dirname(__file__), "token.json")

# Allow HTTP for local development
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
# Don't raise an error if Google returns extra scopes in the token response
os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
CREDENTIALS_FILE = os.path.join(os.path.dirname(__file__), "credentials.json")
# Temporary file that holds state + code_verifier across the OAuth redirect
OAUTH_STATE_FILE = os.path.join(os.path.dirname(__file__), ".oauth_state.json")


def save_token(creds_dict):
    """Write token dict to disk."""
    with open(TOKEN_FILE, "w") as f:
        json.dump(creds_dict, f)


def load_token():
    """Read token dict from disk, or None if it doesn't exist."""
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
    # If token is already saved on disk, skip login entirely
    if "credentials" in session or load_token():
        return redirect(url_for("inbox"))
    return render_template("index.html")


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
    return redirect(url_for("inbox"))


@app.route("/inbox")
def inbox():
    service = get_gmail_service()
    if service is None:
        return redirect(url_for("index"))

    # Fetch user profile
    profile = service.users().getProfile(userId="me").execute()
    user_email = profile.get("emailAddress", "")

    # Fetch only UNREAD inbox emails (50 latest)
    result = service.users().messages().list(
        userId="me", labelIds=["INBOX", "UNREAD"], maxResults=50
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

    return render_template("inbox.html", emails=emails, user_email=user_email)


@app.route("/email/<msg_id>")
def view_email(msg_id):
    service = get_gmail_service()
    if service is None:
        return redirect(url_for("index"))

    msg_data = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()
    headers = parse_headers(msg_data.get("payload", {}).get("headers", []))
    body = decode_body(msg_data.get("payload", {}))
    label_ids = msg_data.get("labelIds", [])
    is_unread = "UNREAD" in label_ids
    is_starred = "STARRED" in label_ids

    # Mark as read — remove the UNREAD label so it disappears from inbox
    if is_unread:
        service.users().messages().modify(
            userId="me",
            id=msg_id,
            body={"removeLabelIds": ["UNREAD"]}
        ).execute()

    sender_name = get_sender_name(headers.get("from", ""))

    email = {
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
    }
    profile = service.users().getProfile(userId="me").execute()
    user_email = profile.get("emailAddress", "")
    return render_template("email.html", email=email, user_email=user_email)


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


def _send_result_reply(service, msg_id: str, result: dict) -> bool:
    """
    Reply to the original email's sender with the unsubscribe outcome.
    Only fires on a successful unsubscribe.
    Returns True if the reply was sent successfully.
    """
    if result.get("status") != "success":
        return False  # only reply on success

    try:
        # Fetch the original email's headers for threading
        meta = service.users().messages().get(
            userId="me", id=msg_id, format="metadata",
            metadataHeaders=["From", "Subject", "Message-ID", "Reply-To"]
        ).execute()

        headers = {h["name"].lower(): h["value"]
                   for h in meta.get("payload", {}).get("headers", [])}

        from_addr   = headers.get("from", "")
        subject     = headers.get("subject", "(no subject)")
        message_id  = headers.get("message-id", "")
        reply_to    = headers.get("reply-to", from_addr)

        # Extract the bare email address from "Name <email@domain>"
        match = re.search(r"<([^>]+)>", reply_to)
        to_email = match.group(1).strip() if match else reply_to.strip()

        if not to_email or "@" not in to_email:
            logger.warning("Cannot send reply for msg %s: no valid To address", msg_id)
            return False

        method  = result.get("method") or "automated"
        reason  = result.get("reason") or ""
        url     = result.get("url") or "N/A"

        body = (
            f"Hi,\n\n"
            f"This is an automated notification from the UnSub tool.\n\n"
            f"I have successfully processed the unsubscribe request for this email address.\n\n"
            f"Details:\n"
            f"  Status : Successfully unsubscribed\n"
            f"  Method : {method}\n"
            f"  URL    : {url}\n"
            f"  Note   : {reason}\n\n"
            f"Please ensure my email address is permanently removed from all your "
            f"mailing lists and distribution groups.\n\n"
            f"Thank you,\n"
            f"UnSub Automation"
        )

        reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"

        msg = MIMEMultipart("alternative")
        msg["To"]         = to_email
        msg["Subject"]    = reply_subject
        if message_id:
            msg["In-Reply-To"] = message_id
            msg["References"]  = message_id

        msg.attach(MIMEText(body, "plain"))

        raw_bytes = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(
            userId="me",
            body={"raw": raw_bytes, "threadId": meta.get("threadId", "")}
        ).execute()

        logger.info("Reply sent to %s for msg %s", to_email, msg_id)
        return True

    except Exception as exc:
        logger.warning("Could not send reply for msg %s: %s", msg_id, exc)
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

        # Mark as read and send reply on success
        marked_read = False
        reply_sent  = False
        if result.get("status") == "success":
            marked_read = _mark_as_read(service, msg_id)
            reply_sent  = _send_result_reply(service, msg_id, result)
        result["marked_read"] = marked_read
        result["reply_sent"]  = reply_sent

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

            # Tally + mark as read + reply on success
            s = result.get("status", "error")
            if s == "success":
                success_count += 1
                result["marked_read"] = _mark_as_read(service, msg_id)
                result["reply_sent"]  = _send_result_reply(service, msg_id, result)
            else:
                result["marked_read"] = False
                result["reply_sent"]  = False
                if s == "skipped":     skipped_count += 1
                elif s == "not_found": not_found_count += 1
                else:                  error_count += 1

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
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=True, port=5000)
