"""
Stage 2: Visit each unsubscribe link from Stage 1 and complete whatever
page appears (one-click confirmation, radio-button preference form, etc.)
using Playwright (browser automation) + Gemini (free tier) to decide what
to click/select on each unknown page.

Setup:
1. pip install playwright google-genai
2. playwright install chromium
3. Get a free Gemini API key: https://aistudio.google.com/app/apikey
4. Set it as an environment variable in the SAME terminal you'll run this from:
     export GEMINI_API_KEY="your-key-here"      (Mac/Linux/bash)
     $env:GEMINI_API_KEY="your-key-here"         (Windows PowerShell)
     set GEMINI_API_KEY=your-key-here            (Windows cmd.exe)
5. Run: python complete_unsubscribes.py

Input:  unsubscribe_links.json   (produced by Stage 1)
Output: unsubscribe_results.json (success/failed/needs_review per link)
"""

import json
import os
import sys
import time

from google import genai
from google.genai import errors as genai_errors
from playwright.sync_api import sync_playwright

MAX_STEPS_PER_PAGE = 4      # safety limit so a confused loop can't run forever
WAIT_AFTER_ACTION_MS = 1500 # let the page settle after a click/submit
GEMINI_MODEL = "gemini-2.5-flash"  # current (2026) free-tier model; 2.0-flash is being phased out

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    sys.exit(
        "GEMINI_API_KEY is not set in this terminal session.\n"
        "PowerShell:  $env:GEMINI_API_KEY=\"your-key-here\"\n"
        "cmd.exe:     set GEMINI_API_KEY=your-key-here\n"
        "Mac/Linux:   export GEMINI_API_KEY=\"your-key-here\"\n"
        "Then re-run this script in the SAME window."
    )

client = genai.Client(api_key=api_key)


def get_clickable_elements(page):
    """Pulls every interactive element on the page (buttons, links, radios,
    checkboxes, selects) with a stable index so the LLM can refer to them
    by number instead of needing exact CSS selectors."""
    elements = page.eval_on_selector_all(
        "button, a, input[type=radio], input[type=checkbox], input[type=submit], select, [role=button]",
        """(nodes) => nodes.map((el, i) => {
            el.setAttribute('data-unsub-idx', i);
            const label = el.innerText || el.value || el.getAttribute('aria-label') || el.placeholder || '';
            return {
                index: i,
                tag: el.tagName.toLowerCase(),
                type: el.getAttribute('type') || '',
                text: label.trim().slice(0, 100),
                checked: el.checked || false,
            };
        })"""
    )
    return elements


def ask_llm_for_action(elements, page_title, attempt_number):
    """Sends the simplified element list to Gemini and asks for the single
    best next action to take toward fully unsubscribing."""
    prompt = f"""You are completing an email unsubscribe flow on a webpage.
Page title: {page_title}
This is attempt #{attempt_number} on this page.

Here are the interactive elements on the page (as JSON):
{json.dumps(elements, indent=2)}

Pick the ONE next action that moves toward FULLY unsubscribing (the option
that results in receiving NO further emails - not "once a month", not
"weekly digest" - the strongest opt-out option available).

If a radio/checkbox needs selecting AND a submit button exists, pick the
radio/checkbox FIRST (you'll be asked again for the next step).

If the page already shows a confirmation that unsubscribe succeeded, or there
is nothing meaningful left to click, respond with action "done".

Respond with ONLY raw JSON, no markdown, no explanation, in this exact shape:
{{"action": "click" | "done", "index": <int or null>, "reason": "<short reason>"}}
"""
    last_error = None
    for retry in range(3):
        try:
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            break
        except genai_errors.ClientError as e:
            last_error = e
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = 40 * (retry + 1)  # back off: 40s, 80s, 120s
                print(f"    Rate limited by Gemini, waiting {wait}s before retry...")
                time.sleep(wait)
                continue
            raise
    else:
        return {"action": "done", "index": None,
                "reason": f"gave up after rate-limit retries: {last_error}"}

    text = response.text.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"action": "done", "index": None, "reason": f"unparseable LLM response: {text[:200]}"}


INTERSTITIAL_TITLE_MARKERS = [
    "just a moment", "checking your browser", "attention required",
    "please wait", "verifying you are human", "cloudflare",
]
CHALLENGE_WAIT_SECONDS = 6   # how long to give Cloudflare's JS check to clear
CHALLENGE_MAX_RETRIES = 3    # how many times to re-check before giving up


def _looks_like_challenge_page(page):
    title = (page.title() or "").lower()
    return any(marker in title for marker in INTERSTITIAL_TITLE_MARKERS)


def _wait_past_challenge(page):
    """If we land on a bot-check interstitial (e.g. Cloudflare's 'Just a
    moment...' page), wait for it to clear on its own rather than treating
    the empty page as a finished/successful unsubscribe. Returns True if we
    got past it, False if it never cleared."""
    for _ in range(CHALLENGE_MAX_RETRIES):
        if not _looks_like_challenge_page(page):
            return True
        time.sleep(CHALLENGE_WAIT_SECONDS)
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass
    return not _looks_like_challenge_page(page)


def process_link(page, link):
    """Drives the unsubscribe flow for a single link. Returns a result dict."""
    try:
        page.goto(link, timeout=20000, wait_until="domcontentloaded")
    except Exception as e:
        return {"status": "failed", "detail": f"navigation error: {e}"}

    if not _wait_past_challenge(page):
        return {
            "status": "needs_review",
            "detail": f"stuck on bot-check interstitial (page title: '{page.title()}'), "
                      f"never reached the real unsubscribe page",
        }

    for attempt in range(1, MAX_STEPS_PER_PAGE + 1):
        time.sleep(WAIT_AFTER_ACTION_MS / 1000)

        # Re-check on every step too — some sites show the challenge only
        # after the first click (e.g. after submitting a form).
        if _looks_like_challenge_page(page):
            if not _wait_past_challenge(page):
                return {
                    "status": "needs_review",
                    "detail": f"hit bot-check interstitial mid-flow (page title: '{page.title()}')",
                }

        elements = get_clickable_elements(page)

        if not elements:
            return {"status": "success", "detail": "no interactive elements left (likely one-click, already completed)"}

        decision = ask_llm_for_action(elements, page.title(), attempt)

        if decision["action"] == "done":
            return {"status": "success", "detail": decision.get("reason", "LLM reported completion")}

        idx = decision.get("index")
        if idx is None:
            return {"status": "needs_review", "detail": "LLM chose click but gave no index"}

        try:
            target = page.locator(f"[data-unsub-idx='{idx}']")
            target.click(timeout=5000)
        except Exception as e:
            return {"status": "needs_review", "detail": f"click failed on index {idx}: {e}"}

    return {"status": "needs_review", "detail": f"hit step limit ({MAX_STEPS_PER_PAGE}) without confirmation"}


def main():
    with open("unsubscribe_links.json") as f:
        entries = json.load(f)

    TEST_LIMIT = 3  # only process the first few links while testing the pipeline
    entries = entries[:TEST_LIMIT]
    print(f"TEST MODE: processing only the first {len(entries)} links.\n")

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # headless is heavily flagged by Cloudflare's bot check
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800},
        )

        for i, entry in enumerate(entries, 1):
            link = entry.get("best_link")
            if not link or link.startswith("mailto:"):
                results.append({**entry, "status": "skipped", "detail": "mailto-only, no web page to automate"})
                print(f"[{i}/{len(entries)}] SKIPPED (mailto): {entry['sender']}")
                continue

            print(f"[{i}/{len(entries)}] Processing: {entry['sender']} -> {link}")
            outcome = process_link(page, link)
            results.append({**entry, **outcome})
            print(f"    -> {outcome['status']}: {outcome['detail']}")

        browser.close()

    with open("unsubscribe_results.json", "w") as f:
        json.dump(results, f, indent=2)

    success = sum(1 for r in results if r["status"] == "success")
    needs_review = sum(1 for r in results if r["status"] == "needs_review")
    failed = sum(1 for r in results if r["status"] == "failed")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    print(f"\nDone. {success} succeeded, {needs_review} need review, {failed} failed, {skipped} skipped.")
    print("Full details in unsubscribe_results.json")


if __name__ == "__main__":
    main()