"""
unsubscribe_engine.py
─────────────────────
Headless-browser automation for email unsubscription.

Pipeline (in order)
────────────────────
1. Extract unsubscribe URL  (List-Unsubscribe header → HTML body scan)
2. Open URL in visible Chromium (headed, slow_mo so user can watch)
3. Check 1  : Page already shows confirmation         → success (direct)
   Check 1b : Page shows "already unsubscribed"      → success (direct)
   Check 2  : Login wall with no unsub content        → skipped
4. Strategy 1 : Click unsubscribe / confirm button    → success (button)
5. Strategy 2 : Fill checkbox/radio form + submit     → success (form)
6. Strategy 3 : Gemini AI fallback (only when 1+2 failed AND interactive
                elements remain on the page)          → success (ai)
7. Blind fallback : URL-load itself was the action    → success (direct)

Return shape
────────────
{
    "status":  "success" | "skipped" | "not_found" | "error",
    "method":  "direct"  | "form"    | "button"    | "ai" | None,
    "reason":  str | None,
    "url":     str | None,
    "error":   str | None,
}
"""

import os
import re
import json
import logging
from typing import Optional
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

logger = logging.getLogger(__name__)

# ── Timeouts ─────────────────────────────────────────────────────────────────
NAV_TIMEOUT       = 25_000
ELEMENT_TIMEOUT   = 6_000
SETTLE_AFTER_NAV  = 3_500
SETTLE_AFTER_ACT  = 4_000

# ── Patterns ─────────────────────────────────────────────────────────────────
UNSUB_LINK_PATTERNS = re.compile(
    r"(unsubscribe|opt[\s\-]?out|optout|remove\s+me|manage\s+preference|"
    r"email\s+preference|notification\s+setting|no\s+more\s+email)",
    re.I,
)

CONFIRM_PATTERNS = re.compile(
    r"(you\s+(have\s+been|are\s+now|will\s+be)\s+(unsubscribed|removed|opted\s+out)|"
    r"successfully\s+unsubscribed|unsubscribed\s+successfully|"
    r"you.ve\s+been\s+unsubscribed|removed\s+from\s+our\s+list|"
    r"preference\s+(saved|updated)|no\s+longer\s+receive|"
    r"opted\s+out|opt.out\s+success|email\s+removed|"
    r"unsubscribe\s+request\s+(received|processed)|"
    r"you.ve\s+been\s+removed|you\s+will\s+no\s+longer|"
    r"email\s+address\s+has\s+been\s+removed)",
    re.I,
)

RESUBSCRIBE_PATTERNS = re.compile(
    r"(re.?subscri|subscribe\s+again|subscribe\s+back|subscribe\s+me\s+again|"
    r"opt.?in|sign\s+me\s+up\s+again|rejoin|re.?join|re.?register)",
    re.I,
)

ALREADY_UNSUB_PATTERNS = re.compile(
    r"(already\s+unsubscribed|currently\s+unsubscribed|not\s+currently\s+subscribed|"
    r"you\s+are\s+(already|currently)\s+(unsubscribed|removed|opted\s+out)|"
    r"you\s+have\s+already\s+(been\s+)?(unsubscribed|removed|opted\s+out)|"
    r"your\s+email\s+is\s+already\s+unsubscribed)",
    re.I,
)

# Checkboxes gating an unsubscribe form (privacy policy / terms acceptance)
PRIVACY_PATTERNS = re.compile(
    r"(privacy\s+policy|terms\s+of\s+service|terms\s+and\s+conditions|"
    r"terms\s+of\s+use|i\s+agree|i\s+accept|accept\s+terms|agree\s+to|"
    r"gdpr|data\s+processing|consent|acknowledge|i\s+understand)",
    re.I,
)

# ════════════════════════════════════════════════════════════════════════════
# 1. URL EXTRACTION
# ════════════════════════════════════════════════════════════════════════════

def extract_unsubscribe_url(
    html_body: str,
    list_unsubscribe_header: Optional[str] = None,
) -> Optional[str]:
    """
    Return the best unsubscribe URL from the email, or None if not found.

    Priority:
      1. List-Unsubscribe header  (HTTP URL preferred over mailto)
      2. Link text / href scan in HTML body
      3. "click here" links whose surrounding text mentions unsubscribe
    """
    if list_unsubscribe_header:
        urls = re.findall(r"<(https?://[^>]+)>", list_unsubscribe_header)
        if urls:
            return urls[0].strip()
        bare = re.findall(r"https?://\S+", list_unsubscribe_header)
        if bare:
            return bare[0].strip().rstrip(",;")

    if not html_body:
        return None

    try:
        soup = BeautifulSoup(html_body, "html.parser")
        candidates = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            link_text = a.get_text(" ", strip=True)

            # For generic "click here" links, check the parent element's text for context
            context_text = ""
            if re.search(r"click\s+here", link_text, re.I) and a.parent:
                context_text = a.parent.get_text(" ", strip=True)

            full_text = f"{href} {link_text} {context_text}"
            if (
                href.startswith("http")
                and UNSUB_LINK_PATTERNS.search(full_text)
                and not href.startswith("mailto:")
            ):
                score = 2 if UNSUB_LINK_PATTERNS.search(href) else 1
                candidates.append((score, href))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            return candidates[0][1]
    except Exception as exc:
        logger.warning("HTML parse error during URL extraction: %s", exc)

    return None


# ════════════════════════════════════════════════════════════════════════════
# 2. PAGE ANALYSIS HELPERS
# ════════════════════════════════════════════════════════════════════════════

def _safe_text(page) -> str:
    try:
        return page.inner_text("body") or ""
    except Exception:
        try:
            return page.evaluate("() => document.body?.innerText || ''") or ""
        except Exception:
            return ""


def _has_confirmation(page) -> bool:
    return bool(CONFIRM_PATTERNS.search(_safe_text(page)))


def _is_login_wall_only(page) -> bool:
    """
    True ONLY if the page is exclusively a login/signup page
    with no unsubscribe form or button present.
    """
    has_password = page.locator("input[type='password']").count() > 0
    has_unsub_content = (
        page.locator("input[type='checkbox']").count() > 0
        or page.locator("input[type='radio']").count() > 0
        or page.locator("button, input[type='submit'], a").filter(
            has_text=re.compile(r"unsubscribe|opt.?out|confirm|remove", re.I)
        ).count() > 0
    )
    if has_password and not has_unsub_content:
        logger.info("Login wall detected (password field, no unsub content)")
        return True
    return False


def _has_remaining_interactives(page) -> bool:
    """
    Returns True if the page still has interactive elements that the
    rule-based engine could not handle — these are the trigger for the
    Gemini fallback:
      - text / email inputs  (not handled by rules)
      - <select> dropdowns   (not handled by rules)
      - <textarea>           (not handled by rules)
      - any visible button inside a <form> or <main>
      - any remaining visible checkbox / radio
    """
    try:
        if page.locator("input[type='text']:visible, input[type='email']:visible").count() > 0:
            logger.info("Gemini trigger: text/email input detected")
            return True
        if page.locator("select:visible").count() > 0:
            logger.info("Gemini trigger: <select> dropdown detected")
            return True
        if page.locator("textarea:visible").count() > 0:
            logger.info("Gemini trigger: <textarea> detected")
            return True
        # Still-visible submit buttons inside a form that we didn't click
        if page.locator("form button:visible, form input[type='submit']:visible").count() > 0:
            logger.info("Gemini trigger: unhandled form button detected")
            return True
        # Remaining visible checkboxes or radios (our rules ran but couldn't submit)
        if page.locator("input[type='checkbox']:visible, input[type='radio']:visible").count() > 0:
            logger.info("Gemini trigger: remaining checkbox/radio detected")
            return True
    except Exception:
        pass
    return False


def _get_label_text(page, element) -> str:
    """Robustly extract label text for a form element."""
    try:
        v = element.get_attribute("aria-label") or ""
        if v.strip():
            return v.strip()

        lb_id = element.get_attribute("aria-labelledby") or ""
        if lb_id:
            try:
                lb = page.locator(f"#{lb_id}")
                if lb.count() > 0:
                    return lb.inner_text().strip()
            except Exception:
                pass

        el_id = element.get_attribute("id") or ""
        if el_id:
            try:
                lbl = page.locator(f"label[for='{el_id}']")
                if lbl.count() > 0:
                    t = lbl.first.inner_text().strip()
                    if t:
                        return t
            except Exception:
                pass

        label_text = element.evaluate("""(el) => {
            const lbl = el.closest('label');
            if (lbl) return lbl.innerText || lbl.textContent || '';
            for (const tag of ['li', 'td', 'div', 'p', 'span', 'tr']) {
                const p = el.closest(tag);
                if (p) {
                    const t = (p.innerText || p.textContent || '').trim();
                    if (t && t.length < 200) return t;
                }
            }
            const ns = el.nextSibling;
            if (ns && ns.nodeType === 3) return ns.textContent.trim();
            return '';
        }""")
        return (label_text or "").strip()
    except Exception:
        return ""


def _safe_click(el):
    try:
        el.scroll_into_view_if_needed(timeout=2000)
    except Exception:
        pass
    try:
        el.click(timeout=ELEMENT_TIMEOUT)
        return True
    except Exception:
        try:
            el.evaluate("el => el.click()")
            return True
        except Exception:
            return False


def _safe_check(el, action="check"):
    try:
        el.scroll_into_view_if_needed(timeout=2000)
    except Exception:
        pass
    try:
        if action == "check":
            el.check(timeout=ELEMENT_TIMEOUT)
        else:
            el.uncheck(timeout=ELEMENT_TIMEOUT)
        return True
    except Exception:
        try:
            el.click(timeout=ELEMENT_TIMEOUT)
            return True
        except Exception:
            return False


# ════════════════════════════════════════════════════════════════════════════
# 3. RULE-BASED ACTION STRATEGIES
# ════════════════════════════════════════════════════════════════════════════

def _try_direct_button(page) -> bool:
    """
    Strategy 1: Find and click a prominent unsubscribe / confirm / opt-out button.
    Any button matching RESUBSCRIBE_PATTERNS is skipped.
    Returns True if a button was successfully clicked.
    """
    button_patterns = [
        ("role_unsub",   lambda p: p.get_by_role("button", name=re.compile(r"unsubscribe", re.I))),
        ("role_optout",  lambda p: p.get_by_role("button", name=re.compile(r"opt.?out", re.I))),
        ("role_confirm", lambda p: p.get_by_role("button", name=re.compile(r"confirm", re.I))),
        ("btn_unsub",    lambda p: p.locator("button:visible").filter(has_text=re.compile(r"unsubscribe", re.I))),
        ("btn_optout",   lambda p: p.locator("button:visible").filter(has_text=re.compile(r"opt.?out", re.I))),
        ("btn_confirm",  lambda p: p.locator("button:visible").filter(has_text=re.compile(r"^confirm$", re.I))),
        ("a_unsub",      lambda p: p.locator("a:visible").filter(has_text=re.compile(r"^unsubscribe$", re.I))),
        ("a_optout",     lambda p: p.locator("a:visible").filter(has_text=re.compile(r"^opt.?out$", re.I))),
        ("a_confirm",    lambda p: p.locator("a:visible").filter(has_text=re.compile(r"^confirm$", re.I))),
        ("input_submit", lambda p: p.locator("input[type='submit']:visible")),
        ("btn_submit",   lambda p: p.locator("button[type='submit']:visible")),
    ]

    for name, locator_fn in button_patterns:
        try:
            els = locator_fn(page)
            if els.count() == 0:
                continue
            el = els.first
            if not el.is_visible():
                continue
            txt = ""
            try:
                txt = el.inner_text().strip()[:80]
            except Exception:
                pass

            if RESUBSCRIBE_PATTERNS.search(txt):
                logger.warning("Skipping resubscribe button [%s]: %r", name, txt)
                continue

            logger.info("Direct button [%s]: %r — clicking", name, txt)
            if _safe_click(el):
                return True
        except Exception as ex:
            logger.debug("Button pattern [%s] error: %s", name, ex)
            continue

    return False


def _check_privacy_boxes(page) -> int:
    """
    Find and CHECK any privacy-policy / terms-of-service / consent checkboxes.
    Many unsubscribe pages require accepting these before the action button
    becomes active or the form can be submitted.

    Returns the number of checkboxes that were ticked.
    Does NOT touch checkboxes that are already checked.
    """
    ticked = 0
    try:
        checkboxes = page.locator("input[type='checkbox']:visible")
        for i in range(checkboxes.count()):
            cb = checkboxes.nth(i)
            label = _get_label_text(page, cb)
            cb_name = cb.get_attribute("name") or ""
            cb_id   = cb.get_attribute("id")   or ""
            combined = f"{label} {cb_name} {cb_id}"

            if PRIVACY_PATTERNS.search(combined):
                try:
                    if not cb.is_checked():
                        _safe_check(cb, "check")
                        logger.info("Checked privacy/terms checkbox: %r", label[:60])
                        ticked += 1
                except Exception:
                    pass
    except Exception as ex:
        logger.debug("Privacy checkbox scan error: %s", ex)
    return ticked


def _try_form_automation(page) -> bool:
    """
    Strategy 2: Handle preference forms (checkboxes / radios + submit).
    Returns True if a submit action was attempted.
    """
    try:
        page.wait_for_selector(
            "input[type='checkbox'], input[type='radio']",
            timeout=4000,
            state="visible",
        )
    except PWTimeout:
        pass

    # Accept any privacy-policy / terms checkboxes first so the form unlocks
    _check_privacy_boxes(page)

    changed_something = False

    # Radios
    radios = page.locator("input[type='radio']")
    rc = radios.count()
    logger.info("Radio buttons found: %d", rc)
    if rc > 0:
        for i in range(rc):
            radio = radios.nth(i)
            label = _get_label_text(page, radio)
            logger.info("  Radio[%d] label: %r", i, label[:80])
            if UNSUB_LINK_PATTERNS.search(label):
                if _safe_check(radio, "check"):
                    changed_something = True
                    logger.info("  → Checked radio[%d]", i)
                    break

    # Checkboxes
    checkboxes = page.locator("input[type='checkbox']")
    cc = checkboxes.count()
    logger.info("Checkboxes found: %d", cc)
    if cc > 0:
        found_master = False
        for i in range(cc):
            cb = checkboxes.nth(i)
            label = _get_label_text(page, cb)
            cb_id   = cb.get_attribute("id")   or ""
            cb_name = cb.get_attribute("name")  or ""
            cb_val  = cb.get_attribute("value") or ""
            combined = f"{cb_id} {cb_name} {cb_val} {label}"
            logger.info("  CB[%d] combined: %r", i, combined[:80])

            if re.search(r"(unsubscribe.?all|opt.?out.?all|all\s+email|all\s+list|everything)", combined, re.I):
                if _safe_check(cb, "check"):
                    found_master = True
                    changed_something = True
                    logger.info("  → Checked master 'all' checkbox[%d]", i)
                    break

        if not found_master:
            for i in range(cc):
                cb = checkboxes.nth(i)
                label = _get_label_text(page, cb)
                logger.info("  Unchecking CB[%d] %r", i, label[:60])
                if _safe_check(cb, "uncheck"):
                    changed_something = True

    # Submit
    submit_selectors = [
        "input[type='submit']:visible",
        "button[type='submit']:visible",
        "button:visible:has-text('Unsubscribe')",
        "button:visible:has-text('Opt out')",
        "button:visible:has-text('Opt Out')",
        "button:visible:has-text('Confirm')",
        "button:visible:has-text('Save')",
        "button:visible:has-text('Update')",
        "button:visible:has-text('Submit')",
        "button:visible:has-text('Done')",
        "button:visible:has-text('Continue')",
        "a:visible:has-text('Unsubscribe')",
        "a:visible:has-text('Confirm')",
        "a:visible:has-text('Opt out')",
        "[role='button']:visible:has-text('Unsubscribe')",
        "[role='button']:visible:has-text('Save')",
    ]

    for selector in submit_selectors:
        try:
            els = page.locator(selector)
            if els.count() == 0:
                continue
            el = els.first
            if not el.is_visible():
                continue
            txt = ""
            try:
                txt = el.inner_text().strip()[:80]
            except Exception:
                pass

            if RESUBSCRIBE_PATTERNS.search(txt):
                logger.warning("Skipping resubscribe submit button: %r", txt)
                continue

            logger.info("Submit button found: %r via %r", txt, selector)
            if _safe_click(el):
                return True
        except Exception as ex:
            logger.debug("Submit selector %r failed: %s", selector, ex)
            continue

    return changed_something


# ════════════════════════════════════════════════════════════════════════════
# 4. GEMINI AI FALLBACK (Strategy 3)
# ════════════════════════════════════════════════════════════════════════════

def _gemini_available() -> bool:
    """True if a Gemini API key is configured."""
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())


def _find_input_by_label(page, label_hint: str):
    """Locate a visible input/textarea by label text, placeholder, aria-label, or name."""
    hint_lower = label_hint.lower()

    # Direct attribute matches
    for sel in [
        f"input[placeholder*='{label_hint}' i]:visible",
        f"input[aria-label*='{label_hint}' i]:visible",
        f"input[name*='{label_hint}' i]:visible",
        f"textarea[placeholder*='{label_hint}' i]:visible",
        f"textarea[aria-label*='{label_hint}' i]:visible",
    ]:
        try:
            el = page.locator(sel)
            if el.count() > 0 and el.first.is_visible():
                return el.first
        except Exception:
            pass

    # Via label[for=id]
    try:
        labels = page.locator("label:visible")
        for i in range(labels.count()):
            lbl = labels.nth(i)
            if hint_lower in (lbl.inner_text() or "").lower():
                for_id = lbl.get_attribute("for")
                if for_id:
                    el = page.locator(f"#{for_id}")
                    if el.count() > 0:
                        return el.first
    except Exception:
        pass

    return None


def _execute_gemini_plan(page, plan: list, user_email: str) -> tuple:
    """
    Execute the action list returned by Gemini.
    Returns (did_something: bool, should_skip: bool).
    """
    if not plan:
        return False, False

    did_anything = False

    for step in plan:
        act = (step.get("action") or "").lower().strip()

        # ── Skip ─────────────────────────────────────────────────────────────
        if act == "skip":
            logger.info("Gemini says skip: %s", step.get("reason", ""))
            return False, True

        # ── Fill text / email input ───────────────────────────────────────────
        elif act == "fill":
            label = step.get("label", "")
            value = step.get("value", "")
            if not value:
                continue
            try:
                el = _find_input_by_label(page, label)
                if el is None:
                    # Fallback to first visible email then text input
                    for sel in ["input[type='email']:visible", "input[type='text']:visible"]:
                        fb = page.locator(sel)
                        if fb.count() > 0:
                            el = fb.first
                            break
                if el:
                    try:
                        el.scroll_into_view_if_needed(timeout=2000)
                    except Exception:
                        pass
                    el.fill(value, timeout=ELEMENT_TIMEOUT)
                    logger.info("Gemini filled %r → %r", label, value[:30])
                    did_anything = True
            except Exception as ex:
                logger.warning("Gemini fill failed (%r): %s", label, ex)

        # ── Click button / link ───────────────────────────────────────────────
        elif act == "click":
            text = step.get("text", "")
            if RESUBSCRIBE_PATTERNS.search(text):
                logger.warning("Gemini click BLOCKED (resubscribe): %r", text)
                continue
            try:
                found = False
                for loc in [
                    page.get_by_role("button", name=re.compile(re.escape(text), re.I)),
                    page.locator("button:visible").filter(has_text=re.compile(re.escape(text), re.I)),
                    page.locator("a:visible").filter(has_text=re.compile(re.escape(text), re.I)),
                    page.locator(f"input[type='submit'][value*='{text}' i]:visible"),
                    page.locator(f"[role='button']:visible").filter(has_text=re.compile(re.escape(text), re.I)),
                ]:
                    try:
                        if loc.count() > 0 and loc.first.is_visible():
                            _safe_click(loc.first)
                            logger.info("Gemini clicked: %r", text)
                            did_anything = True
                            found = True
                            break
                    except Exception:
                        continue
                if not found:
                    logger.warning("Gemini click target not found: %r", text)
            except Exception as ex:
                logger.warning("Gemini click failed (%r): %s", text, ex)

        # ── Select dropdown option ────────────────────────────────────────────
        elif act == "select":
            label = step.get("label", "")
            option = step.get("option", "")
            try:
                sel_el = None
                # Find select by associated label
                try:
                    labels = page.locator("label:visible")
                    for i in range(labels.count()):
                        lbl = labels.nth(i)
                        if label.lower() in (lbl.inner_text() or "").lower():
                            for_id = lbl.get_attribute("for")
                            if for_id:
                                candidate = page.locator(f"select#{for_id}:visible")
                                if candidate.count() > 0:
                                    sel_el = candidate.first
                                    break
                except Exception:
                    pass
                # Fallback: first visible select
                if sel_el is None:
                    fb = page.locator("select:visible")
                    if fb.count() > 0:
                        sel_el = fb.first
                if sel_el:
                    try:
                        sel_el.select_option(label=option, timeout=ELEMENT_TIMEOUT)
                    except Exception:
                        sel_el.select_option(value=option, timeout=ELEMENT_TIMEOUT)
                    logger.info("Gemini selected %r in %r", option, label)
                    did_anything = True
            except Exception as ex:
                logger.warning("Gemini select failed (%r → %r): %s", label, option, ex)

        # ── Check a radio button ──────────────────────────────────────────────
        elif act == "radio":
            label = step.get("label", "")
            try:
                radios = page.locator("input[type='radio']")
                for i in range(radios.count()):
                    radio = radios.nth(i)
                    lbl_text = _get_label_text(page, radio)
                    if label.lower() in lbl_text.lower():
                        _safe_check(radio, "check")
                        logger.info("Gemini checked radio: %r", label)
                        did_anything = True
                        break
            except Exception as ex:
                logger.warning("Gemini radio failed (%r): %s", label, ex)

        # ── Uncheck a checkbox ────────────────────────────────────────────────
        elif act == "uncheck":
            label = step.get("label", "")
            try:
                checkboxes = page.locator("input[type='checkbox']")
                for i in range(checkboxes.count()):
                    cb = checkboxes.nth(i)
                    lbl_text = _get_label_text(page, cb)
                    if not label or label.lower() in lbl_text.lower():
                        _safe_check(cb, "uncheck")
                        logger.info("Gemini unchecked: %r", lbl_text[:40])
                        did_anything = True
            except Exception as ex:
                logger.warning("Gemini uncheck failed (%r): %s", label, ex)

    return did_anything, False


def _gemini_fallback(page, user_email: str, url: str) -> dict:
    """
    Strategy 3: Use Gemini Flash to analyse the page and produce an action
    plan, then execute it with Playwright.

    Triggered only after rule-based strategies have failed AND the page
    still has interactive elements.
    """
    if not _gemini_available():
        logger.warning("Gemini API key not set — fallback unavailable")
        return {
            "status": "error",
            "method": None,
            "reason": "Gemini fallback unavailable (set GEMINI_API_KEY environment variable).",
            "url": url,
            "error": "Missing GEMINI_API_KEY",
        }

    try:
        import google.generativeai as genai

        api_key = os.environ["GEMINI_API_KEY"]
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        # Collect page context
        page_text = _safe_text(page)[:3500]
        screenshot_bytes = page.screenshot(type="png")

        prompt = f"""You are an email unsubscribe automation agent operating a real browser.

GOAL: Complete the unsubscription process on the page shown in the screenshot.
USER EMAIL: {user_email or "user@example.com"}

PAGE TEXT (truncated):
{page_text}

STRICT RULES:
1. NEVER produce a "click" action whose text includes words like: resubscribe, subscribe again, opt in, sign me up, rejoin. These would RE-subscribe the user — forbidden.
2. If a login / sign-up form is the ONLY thing on the page (no unsubscribe option at all), return exactly: [{{"action":"skip","reason":"login required"}}]
3. For any email address input, use the USER EMAIL above.
4. For "reason" dropdowns, radios, or text boxes, choose the most neutral option: "Other", "Too many emails", "No longer interested", or leave blank.
5. Uncheck subscription checkboxes (don't check them).
6. Return ONLY a valid JSON array — no markdown, no explanation.

ACTION TYPES:
  Fill text/email input  → {{"action":"fill",    "label":"<field label>",     "value":"<text>"}}
  Click button or link   → {{"action":"click",   "text":"<visible text>"}}
  Select dropdown option → {{"action":"select",  "label":"<dropdown label>",  "option":"<option text>"}}
  Check a radio button   → {{"action":"radio",   "label":"<radio label text>"}}
  Uncheck a checkbox     → {{"action":"uncheck", "label":"<checkbox label or blank for all>"}}
  Cannot unsubscribe     → {{"action":"skip",    "reason":"<reason>"}}

Return ONLY the JSON array now."""

        image_part = {"mime_type": "image/png", "data": screenshot_bytes}
        response = model.generate_content(
            [prompt, image_part],
            generation_config={"temperature": 0.1, "max_output_tokens": 512},
        )

        raw = response.text.strip()
        logger.info("Gemini raw response: %s", raw[:300])

        # Strip markdown fences if present
        json_str = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.M).strip()
        plan = json.loads(json_str)

        if not isinstance(plan, list):
            raise ValueError(f"Gemini returned non-list: {type(plan)}")

        logger.info("Gemini plan (%d steps): %s", len(plan), plan)

        did_execute, should_skip = _execute_gemini_plan(page, plan, user_email)

        if should_skip:
            return {
                "status": "skipped",
                "method": None,
                "reason": "Gemini AI determined login is required — skipped.",
                "url": url,
                "error": None,
            }

        if did_execute:
            # Wait for page to respond
            try:
                page.wait_for_load_state("networkidle", timeout=SETTLE_AFTER_ACT)
            except PWTimeout:
                page.wait_for_timeout(SETTLE_AFTER_ACT)

            if _has_confirmation(page):
                reason = "Unsubscribed via Gemini AI — confirmation text detected."
            else:
                reason = "Gemini AI completed form actions (no explicit confirmation detected)."

            page.wait_for_timeout(4000)  # let user see the result
            return {
                "status": "success",
                "method": "ai",
                "reason": reason,
                "url": url,
                "error": None,
            }
        else:
            return {
                "status": "error",
                "method": None,
                "reason": "Gemini AI could not execute any actions on this page.",
                "url": url,
                "error": "Gemini execution: no actions performed",
            }

    except json.JSONDecodeError as exc:
        logger.warning("Gemini returned invalid JSON: %s", exc)
        return {
            "status": "error", "method": None,
            "reason": "Gemini returned unparseable response.",
            "url": url, "error": str(exc),
        }
    except Exception as exc:
        logger.warning("Gemini fallback error: %s", exc)
        return {
            "status": "error", "method": None,
            "reason": f"Gemini fallback error: {exc}",
            "url": url, "error": str(exc),
        }


# ════════════════════════════════════════════════════════════════════════════
# 5. MAIN ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════

def run(
    html_body: str,
    list_unsubscribe_header: Optional[str] = None,
    user_email: str = "",
) -> dict:
    """
    Main unsubscribe automation function.

    Parameters
    ──────────
    html_body               : Decoded HTML body of the email.
    list_unsubscribe_header : Value of the List-Unsubscribe email header (optional).
    user_email              : Gmail address of the authenticated user (used by Gemini
                              to fill email-confirmation inputs on unsubscribe pages).
    """
    # ── Step 1: Extract URL ───────────────────────────────────────────────────
    url = extract_unsubscribe_url(html_body, list_unsubscribe_header)
    if not url:
        return {
            "status": "not_found",
            "method": None,
            "reason": "No unsubscribe link found in this email.",
            "url": None,
            "error": None,
        }

    logger.info("═" * 60)
    logger.info("Unsubscribe URL: %s", url)
    logger.info("User email: %s", user_email or "(not provided)")

    # ── Step 2: Open in Chromium ──────────────────────────────────────────────
    # headless=True in production (Render has no display); set
    # PLAYWRIGHT_HEADLESS=false locally to watch the browser.
    _headless = os.environ.get("PLAYWRIGHT_HEADLESS", "true").lower() != "false"
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=_headless,
                slow_mo=700 if not _headless else 0,
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--window-size=1280,900",
                ],
            )
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                java_script_enabled=True,
                viewport={"width": 1280, "height": 900},
                extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
            )
            page = context.new_page()

            # Navigate
            try:
                page.goto(url, timeout=NAV_TIMEOUT, wait_until="domcontentloaded")
                try:
                    page.wait_for_load_state("networkidle", timeout=5000)
                except PWTimeout:
                    pass
                page.wait_for_timeout(SETTLE_AFTER_NAV)
                logger.info("Loaded: %s | Title: %s", page.url, page.title())
            except PWTimeout:
                browser.close()
                return {"status": "error", "method": None,
                        "reason": "Page load timed out.", "url": url, "error": "Navigation timeout"}
            except Exception as nav_err:
                browser.close()
                return {"status": "error", "method": None,
                        "reason": f"Could not load page: {nav_err}", "url": url, "error": str(nav_err)}

            # ── Check 1: Already confirmed? ───────────────────────────────────
            page_text = _safe_text(page)

            if _has_confirmation(page):
                logger.info("Already confirmed on page load.")
                page.wait_for_timeout(4000)
                browser.close()
                return {"status": "success", "method": "direct",
                        "reason": "Confirmation text detected on page load.",
                        "url": url, "error": None}

            # ── Check 1b: Already unsubscribed (offers re-subscribe) ──────────
            if ALREADY_UNSUB_PATTERNS.search(page_text):
                logger.info("Page shows already-unsubscribed state — no action taken.")
                page.wait_for_timeout(4000)
                browser.close()
                return {"status": "success", "method": "direct",
                        "reason": "Already unsubscribed — page shows re-subscribe offer (no action taken).",
                        "url": url, "error": None}

            # ── Check 2: Login wall only (STRICT) ─────────────────────────────
            if _is_login_wall_only(page):
                browser.close()
                return {"status": "skipped", "method": None,
                        "reason": "Login or sign-up required — no unsubscribe action possible.",
                        "url": url, "error": None}

            # ── Strategy 1: Direct button click ───────────────────────────────
            # Accept any privacy/terms checkboxes first — they can gate the action button
            privacy_ticked = _check_privacy_boxes(page)
            if privacy_ticked:
                logger.info("Accepted %d privacy/terms checkbox(es) before strategy 1", privacy_ticked)
                page.wait_for_timeout(800)  # brief pause for any JS unlock animation

            logger.info("Strategy 1: Trying direct button click…")
            clicked = _try_direct_button(page)
            if clicked:
                try:
                    page.wait_for_load_state("networkidle", timeout=SETTLE_AFTER_ACT)
                except PWTimeout:
                    page.wait_for_timeout(SETTLE_AFTER_ACT)

                if _has_confirmation(page):
                    reason = "Unsubscribed — clicked confirm button, confirmation detected."
                else:
                    reason = "Unsubscribe button clicked (no explicit confirmation text found)."
                page.wait_for_timeout(4000)
                browser.close()
                return {"status": "success", "method": "button",
                        "reason": reason, "url": url, "error": None}

            # ── Strategy 2: Checkbox / radio form ─────────────────────────────
            has_cb = page.locator("input[type='checkbox']").count() > 0
            has_rb = page.locator("input[type='radio']").count() > 0
            form_submitted = False

            if has_cb or has_rb:
                logger.info("Strategy 2: Trying form automation (cb=%s, rb=%s)…", has_cb, has_rb)
                form_submitted = _try_form_automation(page)
                if form_submitted:
                    try:
                        page.wait_for_load_state("networkidle", timeout=SETTLE_AFTER_ACT)
                    except PWTimeout:
                        page.wait_for_timeout(SETTLE_AFTER_ACT)

                    if _has_confirmation(page):
                        reason = "Unsubscribed via preference form — confirmation detected."
                    else:
                        reason = "Preference form submitted (no explicit confirmation text found)."
                    page.wait_for_timeout(4000)
                    browser.close()
                    return {"status": "success", "method": "form",
                            "reason": reason, "url": url, "error": None}
                else:
                    logger.info("Strategy 2 could not submit — checking for Gemini fallback.")

            # ── Strategy 3: Gemini AI fallback ────────────────────────────────
            # Triggered only when rule-based strategies failed AND the page still
            # has interactive elements that rules can't handle.
            rule_based_failed = not clicked and not form_submitted

            if rule_based_failed and _has_remaining_interactives(page):
                if _gemini_available():
                    logger.info("Strategy 3: Gemini AI fallback triggered.")
                    result = _gemini_fallback(page, user_email, url)
                    browser.close()
                    return result
                else:
                    logger.warning(
                        "Strategy 3: Gemini would help here but GEMINI_API_KEY is not set. "
                        "Set it to enable AI fallback for complex pages."
                    )
                    browser.close()
                    return {
                        "status": "error", "method": None,
                        "reason": (
                            "Page has interactive elements that require AI assistance "
                            "(text inputs / dropdowns). Set GEMINI_API_KEY to enable."
                        ),
                        "url": url, "error": "Gemini not configured",
                    }

            # ── Fallback: URL-load itself was the action ───────────────────────
            logger.info("No interactive elements remaining — URL-load was the action.")
            page.wait_for_timeout(4000)
            browser.close()
            return {"status": "success", "method": "direct",
                    "reason": "Unsubscribe URL opened — action processed automatically by the page.",
                    "url": url, "error": None}

    except Exception as exc:
        logger.exception("Unsubscribe engine unexpected error")
        return {"status": "error", "method": None,
                "reason": f"Unexpected error: {exc}", "url": url, "error": str(exc)}
