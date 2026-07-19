"""Drive the SLACK WEB CLIENT like a human user — the agent tests our own Slack app.

Opens a VISIBLE Chromium window with a persistent profile (log into Slack once;
the session is remembered for future runs). Then the same Qwen vision loop
from agent.py chats with the Sky Launchpad bot and fills its wizard forms,
screenshotting every step.

Usage:
    python tester/slack_ui_test.py --workspace-url https://app.slack.com/client/<TEAM>/<CHANNEL>
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from agent import REPO_ROOT, run_case  # noqa: E402  (also loads project/.env + models)

PROFILE_DIR = REPO_ROOT / "tester" / ".slack-profile"

CASES = [
    {
        "id": "slack-full",
        "title": "Full flow: chat with the bot, open the wizard, fill and submit the form",
        "objective": "Mention the bot, open its reply thread, click Guided Wizard, walk the modal and submit the architecture form.",
        "steps": [
            "The bot may already have replied to an earlier mention: look for a message '@Sky Launchpad hello' with a '1 reply' link under it — click that '1 reply' link to open the thread panel on the right. If there is no such message, first send '@Sky Launchpad hello' (handle the autocomplete popup) and wait for the reply, then open it",
            "In the thread panel on the right, find the bot's card ('Sky Launchpad — what are we building today?') and click the green 'Guided Wizard' button",
            "A modal titled 'Sky Launchpad' opens with two options; click the 'Start' button next to 'Guided Wizard'",
            "In the provider list, click the 'Select' button next to 'Alibaba Cloud'",
            "Click the 'Project title' input field and type 'Demo notes app'",
            "Click the larger 'Project description' text area and type 'A tiny notes web app with a signup form, for a live demo'",
            "Click the 'Generate Architecture' button at the bottom-right of the modal",
        ],
        "expected": "The modal closes and a message appears saying the architecture is being designed (a loading message mentioning Qwen or Qwen with an elapsed timer).",
    },
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace-url", required=True)
    ap.add_argument("--max-steps", type=int, default=16)
    args = ap.parse_args()

    run_dir = REPO_ROOT / "tester" / "runs" / f"slack-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    run_dir.mkdir(parents=True, exist_ok=True)

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(PROFILE_DIR), headless=False,
            viewport={"width": 1280, "height": 800},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(args.workspace_url, wait_until="load")

        # Wait (up to 5 min) for the user to be logged in: the client is ready
        # when the message composer exists.
        print("waiting for Slack login (log in once in the opened window)…", file=sys.stderr)
        ready = False
        for _ in range(150):
            try:
                if page.locator('[data-qa="message_input"]').count() > 0:
                    ready = True
                    break
            except Exception:
                pass
            time.sleep(2)
        if not ready:
            print(json.dumps({"error": "Slack client never became ready (login timeout)"}))
            ctx.close()
            return
        print("Slack client ready — starting the agent", file=sys.stderr)
        time.sleep(2)

        results = []
        for i, case in enumerate(CASES, 1):
            print(f"case {i}/{len(CASES)}: {case['title']}", file=sys.stderr)
            res = run_case(page, case, run_dir, i, args.max_steps, args.workspace_url)
            res["case"] = case
            results.append(res)
        ctx.close()

    print(json.dumps({
        "run_dir": str(run_dir),
        "cases": [{
            "title": r["case"]["title"], "status": r["status"], "reason": r.get("reason", ""),
            "screenshots": r.get("screenshots", []),
        } for r in results],
    }, indent=2))


if __name__ == "__main__":
    main()
