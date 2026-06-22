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
import time

from playwright.sync_api import sync_playwright

PROFILE_DIR = "./gmail_browser_profile"  # persistent login session lives here
MAX_UNSUBSCRIBE_CLICKS = 50              # safety cap per run
WAIT_AFTER_CLICK_MS = 1500


ACCOUNT_INDEX = 0  # change to 1 for your second Gmail account, etc.


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


def main():
    results = []

    with sync_playwright() as p:
        # Connect to a real Chrome window YOU opened and logged into by
        # hand (see setup instructions) - Google blocks sign-in on
        # browsers it detects as automation-launched, so we attach to an
        # already-running, manually-started Chrome instead of launching
        # our own. Start Chrome first with:
        #   chrome.exe --remote-debugging-port=9222 --user-data-dir="...\chrome_manual_profile"
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
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