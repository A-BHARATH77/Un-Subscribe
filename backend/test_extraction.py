"""
test_extraction.py
──────────────────
Tests the EXACT extraction logic inside _store_result_in_db() from app.py.

Mocks out:
  • The Gmail API call  (service.users().messages().get().execute())
  • The Supabase POST   (app.http_requests.post)

Nothing is stored in the database. The script just prints what WOULD have been
stored as organization_name and sender_email.

Run:
    python test_extraction.py
"""

import base64
import sys
import os
from unittest.mock import MagicMock, patch

# ── Make sure app.py is importable ───────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Silence Flask startup noise and scheduler threads before importing app
os.environ.setdefault("TESTING", "1")

# We need to prevent the background scheduler + keep-alive from starting.
# Patch them out BEFORE importing the module.
from unittest.mock import patch as _patch
with _patch("threading.Thread"):
    import app as _app_module   # import triggers start_auto_scheduler / start_keep_alive

# Grab the real function
_store_result_in_db = _app_module._store_result_in_db


# ── Helpers ───────────────────────────────────────────────────────────────────

def _b64(text: str) -> str:
    """Encode a string to base64url (as Gmail API returns)."""
    return base64.urlsafe_b64encode(text.encode("utf-8")).decode("ascii").rstrip("=")


def _make_gmail_payload(from_header: str, to_header: str, body_html: str) -> dict:
    """
    Build a fake Gmail API message dict that decode_body() and the header
    reader in _store_result_in_db() can consume.
    """
    headers = []
    if from_header:
        headers.append({"name": "From", "value": from_header})
    if to_header:
        headers.append({"name": "To",   "value": to_header})

    return {
        "payload": {
            "headers": headers,
            "body": {"data": _b64(body_html)},   # decoded by decode_body()
        }
    }


def _make_service(gmail_payload: dict) -> MagicMock:
    """Return a MagicMock Gmail service whose .get().execute() returns the payload."""
    service = MagicMock()
    (service.users.return_value
           .messages.return_value
           .get.return_value
           .execute.return_value) = gmail_payload
    return service


def run_case(label: str, from_header: str, to_header: str, body_html: str,
             expected_org: str, expected_email: str):
    """Run one test case and print results."""

    gmail_payload = _make_gmail_payload(from_header, to_header, body_html)
    service       = _make_service(gmail_payload)
    captured      = {}

    # Intercept the Supabase POST — capture what WOULD be stored
    def fake_post(url, json=None, headers=None, timeout=None, **kw):
        if json:
            captured.update(json)
        resp = MagicMock()
        resp.status_code = 201
        return resp

    with patch.object(_app_module, "http_requests") as mock_http:
        mock_http.post.side_effect = fake_post
        mock_http.get.return_value = MagicMock(status_code=200, json=lambda: [])

        _store_result_in_db(service, "fake_msg_id", {"status": "success"})

    org   = captured.get("organization_name", "<not captured>")
    email = captured.get("sender_email",      "<not captured>")

    ok_org   = org   == expected_org
    ok_email = email == expected_email
    status   = "✅ PASS" if (ok_org and ok_email) else "❌ FAIL"

    SEP = "─" * 65
    print(SEP)
    print(f"  {status}  {label}")
    print(f"  org_name     got={org!r}")
    print(f"             want={expected_org!r}  {'✓' if ok_org else '✗'}")
    print(f"  sender_email got={email!r}")
    print(f"             want={expected_email!r}  {'✓' if ok_email else '✗'}")

    return ok_org and ok_email


# ── Test cases ────────────────────────────────────────────────────────────────

CASES = [
    # ── Case 1: Gmail "Forwarded message" style ───────────────────────────────
    dict(
        label         = "Case 1 — Gmail forwarded marker",
        from_header   = "bharatharavindhan04@gmail.com",   # outer From (the forwarder)
        to_header     = "",
        body_html     = """\
---------- Forwarded message ---------
From: Jooble &lt;subscribe@in.jooble.org&gt;
Date: Sun, Jun 28, 2026 at 8:45 AM
Subject: Thanks for choosing Jooble
To: &lt;bharatharavindhan04@gmail.com&gt;

Some newsletter body content here...
""",
        expected_org   = "Jooble",
        expected_email = "bharatharavindhan04@gmail.com",
    ),

    # ── Case 2: Raw paste — bare To: address ─────────────────────────────────
    dict(
        label         = "Case 2 — Raw paste, bare To address",
        from_header   = "",
        to_header     = "",
        body_html     = """\
From: Shelby American Collection &lt;info@shelbyamericancollection.org&gt;
Date: August 2, 2026 at 9:16:20 AM PDT
To: rovert12992@gmail.com
Subject: Just 29 days to enter for this Shelby GT500 in Twister Orange
Reply-To: info@shelbyamericancollection.org

Newsletter content here...
""",
        expected_org   = "Shelby American Collection",
        expected_email = "rovert12992@gmail.com",
    ),

    # ── Case 3: Raw paste — To: has display name ─────────────────────────────
    dict(
        label         = "Case 3 — Raw paste, To has display name",
        from_header   = "",
        to_header     = "",
        body_html     = """\
From: The AlphaSense Team &lt;marketing@em.alpha-sense.com&gt;
Date: August 27, 2026 at 5:08:27 AM PDT
To: Trevor Friedman &lt;TFriedman@harveyllc.com&gt;
Subject: 8 debates behind healthcare's next wave of M&A and IPOs
Reply-To: marketing@em.alpha-sense.com

Newsletter content here...
""",
        expected_org   = "The AlphaSense Team",
        expected_email = "TFriedman@harveyllc.com",
    ),

    # ── Case 4: Direct inbox email — Gmail API headers only ──────────────────
    dict(
        label         = "Case 4 — Direct inbox (Gmail API headers, no forwarded block)",
        from_header   = "Priceline Deals <deals@email.priceline.com>",
        to_header     = "user@example.com",
        body_html     = "<p>Click here to unsubscribe from our mailing list.</p>",
        expected_org   = "Priceline Deals",
        expected_email = "user@example.com",
    ),

    # ── Case 5: Forwarded, From has no display name ───────────────────────────
    dict(
        label         = "Case 5 — Forwarded, From has no display name",
        from_header   = "",
        to_header     = "",
        body_html     = """\
---------- Forwarded message ---------
From: &lt;noreply@news.example.com&gt;
Date: Mon, Sep 1, 2026 at 10:00 AM
To: &lt;someuser@gmail.com&gt;

Newsletter body...
""",
        expected_org   = "noreply@news.example.com",   # fallback to email when no name
        expected_email = "someuser@gmail.com",
    ),

    # ── Case 6: Gmail API headers, To has display name ───────────────────────
    dict(
        label         = "Case 6 — Gmail API headers, To has display name",
        from_header   = "Nike <news@nike.com>",
        to_header     = "John Doe <john@example.com>",
        body_html     = "<p>Thanks for subscribing to Nike updates.</p>",
        expected_org   = "Nike",
        expected_email = "john@example.com",
    ),
]


# ── Runner ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = [run_case(**c) for c in CASES]
    passed  = sum(results)
    failed  = len(results) - passed
    print("─" * 65)
    print(f"\n  Total: {passed} passed, {failed} failed out of {len(CASES)} cases.\n")
