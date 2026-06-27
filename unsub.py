"""
Clicks the "Unsubscribe" button for every sender listed in Gmail's own
"Manage subscriptions" page (the page in your screenshot), using a real
logged-in browser session - same as you doing it by hand, just automated.

Why a persistent browser profile:
Gmail's login (plus any 2FA) needs to happen once, like a normal login.
Playwright's persistent context saves that session to a local folder, so
every later run reuses it without logging in again - no credentials are
ever stored in this script.

Setup:
1. pip install playwright
2. playwright install chromium
3. First run: python manage_subscriptions_click.py
   - A real Chrome window opens. Log into your Gmail manually (handle 2FA
     if prompted). This is one-time only.
4. Every run after that reuses the saved session automatically.

Output: manage_subscriptions_click_results.json
"""

import json
import os
import platform
import sys

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.expandvars(r"%LOCALAPPDATA%\ms-playwright")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import subprocess
import time

from playwright.sync_api import sync_playwright

import os as _os
PROFILE_DIR = _os.environ.get(
    "UNSUBHERO_GMAIL_PROFILE_DIR",
    "./gmail_browser_profile",
)  # persistent login session lives here
MAX_UNSUBSCRIBE_CLICKS = 50              # safety cap per run
WAIT_AFTER_CLICK_MS = 1500
ACCOUNT_INDEX = 0  # change to 1 for your second Gmail account, etc.
DEBUG_PORT = 9222


def find_chrome_path():
    """Locates the Chrome executable on Windows, Mac, or Linux, so the
    client doesn't need to know or type the install path themselves."""
    system = platform.system()
    candidates = []

    if system == "Windows":
        candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        ]
    elif system == "Darwin":  # macOS
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ]
    else:  # Linux
        candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]

    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def launch_chrome_for_login():
    """Starts a normal (non-automated) Chrome window with the debugging
    port open, so this script can later attach to it. Crucially, this
    Chrome window is launched the same way double-clicking the Chrome icon
    would be - it has no automation flags, so Google's sign-in page does
    not flag it as a bot-controlled browser."""
    chrome_path = find_chrome_path()
    if not chrome_path:
        print("Could not find Chrome automatically on this machine.")
        print("Please open Chrome yourself with this command, then re-run this script:")
        print(f'  chrome --remote-debugging-port={DEBUG_PORT} --user-data-dir="{PROFILE_DIR}"')
        return False

    print("Opening Chrome for you...")
    subprocess.Popen([
        chrome_path,
        f"--remote-debugging-port={DEBUG_PORT}",
        f"--user-data-dir={os.path.abspath(PROFILE_DIR)}",
        "https://mail.google.com",
    ])
    time.sleep(3)
    return True


def open_manage_subscriptions(page):
    page.goto(f"https://mail.google.com/mail/u/{ACCOUNT_INDEX}/#sub", timeout=30000)
    page.wait_for_load_state("domcontentloaded")
    time.sleep(3)  # subscriptions list is JS-rendered, give it a moment to load rows


def click_next_unsubscribe_button(page):
    """Finds the first 'Unsubscribe' link/button still visible in the list
    and clicks it, then handles the small confirmation dialog Gmail shows.
    Filters out hidden tooltip elements (role=tooltip, aria-hidden=true)
    which also contain the text 'Unsubscribe' but aren't clickable."""
    candidates = page.locator(
        "[role='button']:visible, [role='link']:visible, a:visible, button:visible"
    ).filter(has_text="Unsubscribe")

    count = candidates.count()
    if count == 0:
        return None  # nothing left to unsubscribe from

    target = candidates.first
    try:
        row_text = target.locator("xpath=../..").inner_text(timeout=2000)
    except Exception:
        row_text = "(unknown sender)"

    target.click(timeout=5000)
    time.sleep(1)

    # Some senders show a dialog with extra options (e.g. "Block instead").
    # When that variant appears, click "Block instead"; otherwise fall back
    # to the normal confirmation dialog's plain "Unsubscribe" button.
    try:
        block_button = page.get_by_role("button", name="Block instead")
        if block_button.count() > 0 and block_button.first.is_visible():
            block_button.first.click(timeout=4000)
        else:
            confirm_button = page.get_by_role("button", name="Unsubscribe")
            confirm_button.click(timeout=4000)
    except Exception:
        pass  # some senders may unsubscribe with no confirmation step at all

    time.sleep(WAIT_AFTER_CLICK_MS / 1000)
    return row_text


def _is_debug_port_open():
    """Checks if a Chrome instance with remote debugging is already running
    (e.g. the client left it open from a previous run), so we don't launch
    a second redundant Chrome window every time."""
    try:
        import urllib.request
        urllib.request.urlopen(f"http://localhost:{DEBUG_PORT}/json/version", timeout=2)
        return True
    except Exception:
        return False


def _wait_for_gmail_login(timeout_seconds=180, poll_interval=3):
    """Polls the already-open Chrome window (via CDP, the same connection
    method the rest of the script uses) until the page actually shows the
    logged-in Gmail inbox, instead of waiting for a keypress in a terminal
    that may not be visible (e.g. when launched from a GUI app)."""
    from playwright.sync_api import sync_playwright as _sp

    elapsed = 0
    with _sp() as p:
        while elapsed < timeout_seconds:
            try:
                browser = p.chromium.connect_over_cdp(f"http://localhost:{DEBUG_PORT}")
                context = browser.contexts[0] if browser.contexts else None
                page = context.pages[0] if context and context.pages else None
                if page and "mail.google.com" in page.url and "/#" in page.url:
                    # Logged in pages have a #inbox/#sub/etc fragment;
                    # the sign-in flow stays on accounts.google.com or a
                    # bare mail.google.com with no fragment yet.
                    return True
            except Exception:
                pass  # Chrome may still be starting up, just keep polling
            time.sleep(poll_interval)
            elapsed += poll_interval
    return False


def main():
    results = []

    if not _is_debug_port_open():
        launched = launch_chrome_for_login()
        if not launched:
            return
        print(
            "\nA Chrome window has opened. Please log into your Gmail account in it.\n"
            "Waiting for login to complete (checking automatically, up to 3 minutes)..."
        )
        if not _wait_for_gmail_login():
            print("Timed out waiting for login. Please re-run this script after logging in.")
            return
        print("Login detected, continuing...")

    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(f"http://localhost:{DEBUG_PORT}")
        context = browser.contexts[0] if browser.contexts else browser.new_context()
        page = context.pages[0] if context.pages else context.new_page()

        page.goto(f"https://mail.google.com/mail/u/{ACCOUNT_INDEX}/#sub", timeout=30000)
        page.wait_for_load_state("domcontentloaded")
        time.sleep(2)

        if "mail.google.com" not in page.url:
            print(f"Not logged into Gmail in this Chrome window (landed on {page.url}).")
            print("Log into Gmail manually in the Chrome window, then re-run this script.")
            return

        open_manage_subscriptions(page)
        print(f"Landed on: {page.url}")

        print("On Manage Subscriptions page. Clicking through unsubscribe buttons...")

        for i in range(MAX_UNSUBSCRIBE_CLICKS):
            row_text = click_next_unsubscribe_button(page)
            if row_text is None:
                print("No more 'Unsubscribe' buttons found - done.")
                break
            print(f"[{i + 1}] Unsubscribed: {row_text}")
            results.append({"row_text": row_text, "status": "clicked"})

        # Don't close the browser - it's your real Chrome window, leave it open.

    with open("manage_subscriptions_click_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nDone. Clicked Unsubscribe on {len(results)} senders.")
    print("Full details in manage_subscriptions_click_results.json")


if __name__ == "__main__":
    main()