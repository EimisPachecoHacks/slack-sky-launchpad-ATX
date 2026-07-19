"""Deterministic full-flow demo of the Sky Launchpad Slack app, with screenshots.

Unlike the vision agent (which is for testing UNKNOWN apps), this drives our own
Slack UI with exact selectors, so the flow completes reliably:

  mention bot -> open thread -> Guided Wizard -> Start -> Alibaba Cloud ->
  fill title + description -> Generate Architecture -> wait for the live
  "Designing…" message -> (bonus) wait for the review card.

Screenshots land in tester/runs/slack-flow-<ts>/ at every step.

Usage:
    python tester/slack_ui_flow.py --workspace-url https://app.slack.com/client/<TEAM>/<CH>
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
PROFILE_DIR = REPO_ROOT / "tester" / ".slack-profile"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace-url", required=True)
    args = ap.parse_args()

    run_dir = REPO_ROOT / "tester" / "runs" / f"slack-flow-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=True)
    shots: list[str] = []
    n = 0

    from playwright.sync_api import sync_playwright

    def snap(page, name):
        nonlocal n
        n += 1
        p = run_dir / f"{n:02d}_{name}.png"
        page.screenshot(path=str(p))
        shots.append(str(p))
        print(f"  📸 {p.name}", file=sys.stderr)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(PROFILE_DIR), headless=False,
            viewport={"width": 1280, "height": 800},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(args.workspace_url, wait_until="load")
        page.wait_for_selector('[data-qa="message_input"]', timeout=120000)
        time.sleep(2)
        snap(page, "channel_loaded")

        # 1) Clean the composer (previous runs may have left junk), mention the bot.
        composer = page.locator('[data-qa="message_input"]').first
        composer.click()
        page.keyboard.press("Meta+A")
        page.keyboard.press("Backspace")
        page.keyboard.type("@Sky Launchpad", delay=60)
        time.sleep(1.5)  # let the autocomplete popup settle
        snap(page, "mention_autocomplete")
        page.keyboard.press("Enter")  # accept the highlighted mention
        time.sleep(0.5)
        page.keyboard.type(" hello", delay=40)
        page.keyboard.press("Enter")  # send
        time.sleep(3)
        snap(page, "mention_sent")

        # 2) Open the bot's threaded reply.
        page.wait_for_selector('[data-qa="reply_bar_count"]', timeout=30000)
        page.locator('[data-qa="reply_bar_count"]').last.click()
        time.sleep(2)
        snap(page, "thread_open")

        # 3) Click "Guided Wizard" in the thread panel.
        page.get_by_role("button", name="Guided Wizard").last.click()
        page.wait_for_selector('div[role="dialog"]', timeout=15000)
        time.sleep(1)
        snap(page, "wizard_modal_method")

        dialog = page.locator('div[role="dialog"]').last

        # 4) Method step -> Start (guided).
        dialog.get_by_role("button", name="Start", exact=True).first.click()
        time.sleep(1.5)
        snap(page, "wizard_modal_provider")

        # 5) Provider step -> the 4th "Select" is Alibaba Cloud (aws/azure/gcp/alicloud).
        dialog = page.locator('div[role="dialog"]').last
        dialog.get_by_role("button", name="Select", exact=True).nth(3).click()
        time.sleep(1.5)
        snap(page, "wizard_modal_form")

        # 6) Fill the use-case form (block order: title, description, requirements).
        dialog = page.locator('div[role="dialog"]').last
        inputs = dialog.locator('textarea, input[type="text"]')
        inputs.nth(0).click()
        page.keyboard.type("Demo notes app", delay=25)
        inputs.nth(1).click()
        page.keyboard.type("A tiny notes web app with a signup form and a todo list, for a live hackathon demo.", delay=10)
        snap(page, "form_filled")

        # 7) Submit.
        dialog.get_by_role("button", name="Generate Architecture").click()
        time.sleep(3)
        snap(page, "submitted_loading")

        # 8) Wait for the live loading message, then (up to 4 min) the review card.
        try:
            page.wait_for_selector('text=Designing', timeout=20000)
            snap(page, "designing_message")
        except Exception:
            pass
        try:
            page.get_by_role("button", name="Generate Code").last.wait_for(timeout=240000)
            time.sleep(1)
            snap(page, "review_card")
        except Exception:
            snap(page, "final_state")

        ctx.close()

    print(json.dumps({"run_dir": str(run_dir), "screenshots": shots}, indent=2))


if __name__ == "__main__":
    main()
