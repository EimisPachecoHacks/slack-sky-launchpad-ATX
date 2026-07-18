"""Sky Launchpad autonomous UI tester — computer-use style, powered by Nemotron.

Acts like a human user on a deployed web app:

  1. Nemotron 3 Nano 30B (self-hosted vLLM) reads the app description and
     WRITES the test cases — including "known pitfalls" retrieved from the
     learned-skills memory (Supabase pgvector), so past lessons shape new runs.
  2. For every step, a real Chromium (Playwright) page is SCREENSHOTTED and the
     Nemotron Nano VL vision model decides the next action (click/type/verdict)
     from the pixels — no selectors, no DOM assumptions.
  3. Verdicts land in skydb (test_cases / test_runs -> Supabase). Every bug
     found is distilled into a learned skill (SKILL.md + Nemotron embedding),
     which future runs retrieve — the Recursive Intelligence loop.

Every screenshot is saved under the run directory and listed in the JSON
summary printed to stdout (the Slack app uploads them with the results).

Usage:
    python nvidia/tester/agent.py --url http://<app-ip> [--app-name skynotes]
        [--out runs] [--max-cases 4] [--max-steps 8]
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))          # skydb, deployer
sys.path.insert(0, str(REPO_ROOT / "nvidia"))  # backend (NVIDIA variant)

# Load nvidia/.env (last occurrence wins, like dotenv) without overriding real env.
_env_file_vars = {}
for line in (REPO_ROOT / "nvidia" / ".env").read_text().splitlines():
    m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
    if m:
        _env_file_vars[m.group(1)] = m.group(2)  # last occurrence wins, like dotenv
for _k, _v in _env_file_vars.items():
    os.environ.setdefault(_k, _v)  # real env still beats the file

from backend import llm_client  # noqa: E402  (NVIDIA variant: vLLM chat + NIM vision)
import skydb  # noqa: E402
from deployer import skill_library  # noqa: E402


def _json_from(text: str):
    """Parse JSON out of an LLM reply (tolerates fences and prose)."""
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("["), text.rfind("]")
    if start == -1 or (text.find("{") != -1 and text.find("{") < start):
        start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON found in: {text[:200]}")
    return json.loads(text[start:end + 1])


def make_plan(url: str, app_name: str, max_cases: int) -> list[dict]:
    """Nemotron 30B writes the test plan, informed by learned skills."""
    known = skill_library.get_learned_skills_context(query=f"web ui testing {app_name} signup todo form validation") or ""
    for s in skydb.find_similar_skills(f"web ui testing {app_name}", k=3):
        if s.get("slug"):
            skydb.incr_skill_hit(s["slug"])  # count the reuse (delta metric)
    prompt = f"""You are a QA engineer. Write up to {max_cases} UI test cases for the web app at {url}
(name: {app_name}). It appears to be a small site with a signup form (name, email, password)
and a todo list (add, delete).

{f'KNOWN PITFALLS from previous testing of OTHER apps (use only the general LESSONS — e.g. "check empty-input validation", "verify the right item is affected by destructive actions" — do NOT copy app-specific features that this app does not have):{chr(10)}{known}' if known else ''}

Return ONLY a JSON array. Each item: {{"id": "tc-1", "title": "...", "objective": "...",
"steps": ["...", "..."], "expected": "..."}}. Every case MUST be executable against the
features actually described above (signup form, todo list). Focus on validation gaps and
destructive actions."""
    return _json_from(llm_client.chat(prompt, temperature=0.1, kind="testplan"))[:max_cases]


ACTION_PROMPT = """You are a meticulous UI test agent controlling a real browser via screenshots.
Viewport is 1280x800; coordinates are absolute pixels from the top-left.

TEST CASE: {title}
OBJECTIVE: {objective}
STEPS: {steps}
EXPECTED: {expected}

ACTIONS TAKEN SO FAR:
{history}

Look at the CURRENT screenshot and decide the single next action.
Return ONLY a JSON object, one of:
  {{"action":"click","x":123,"y":456,"why":"..."}}
  {{"action":"type","x":123,"y":456,"text":"...","why":"..."}}   (clicks the field, then types)
  {{"action":"press","key":"Enter","why":"..."}}
  {{"action":"verdict","verdict":"pass|fail","reason":"what you observed vs expected"}}
Give a verdict as soon as the expected outcome is confirmed or clearly violated.
If a bug is present (e.g. invalid input accepted, wrong item affected), verdict MUST be "fail" with the evidence."""


def run_case(page, case: dict, run_dir: Path, case_idx: int, max_steps: int, url: str) -> dict:
    history: list[str] = []
    shots: list[str] = []
    page.goto(url, wait_until="load")
    time.sleep(0.6)
    for step in range(1, max_steps + 1):
        shot = run_dir / f"case{case_idx}_step{step}.png"
        page.screenshot(path=str(shot))
        shots.append(str(shot))
        b64 = base64.b64encode(shot.read_bytes()).decode()
        prompt = ACTION_PROMPT.format(
            title=case.get("title", ""), objective=case.get("objective", ""),
            steps="; ".join(case.get("steps", [])), expected=case.get("expected", ""),
            history="\n".join(history) or "(none yet)",
        )
        act = None
        for attempt in (1, 2):  # one retry — hosted endpoints throw transient 5xx
            try:
                act = _json_from(llm_client.vision_chat(b64, "png", prompt, temperature=0.0, kind="uitest"))
                break
            except Exception as exc:
                if attempt == 2:
                    return {"status": "inconclusive", "reason": f"vision step failed: {exc}", "screenshots": shots, "steps_taken": history}
                time.sleep(5)

        kind = act.get("action")
        if kind == "verdict":
            page.screenshot(path=str(run_dir / f"case{case_idx}_final.png"))
            shots.append(str(run_dir / f"case{case_idx}_final.png"))
            return {"status": act.get("verdict", "inconclusive"), "reason": act.get("reason", ""),
                    "screenshots": shots, "steps_taken": history}
        try:
            if kind == "click":
                page.mouse.click(int(act["x"]), int(act["y"]))
                history.append(f"{step}. clicked ({act['x']},{act['y']}) — {act.get('why','')}")
            elif kind == "type":
                page.mouse.click(int(act["x"]), int(act["y"]))
                page.keyboard.type(str(act.get("text", "")), delay=15)
                history.append(f"{step}. typed {act.get('text','')!r} at ({act['x']},{act['y']}) — {act.get('why','')}")
            elif kind == "press":
                page.keyboard.press(str(act.get("key", "Enter")))
                history.append(f"{step}. pressed {act.get('key','Enter')}")
            else:
                history.append(f"{step}. unknown action {kind!r} ignored")
        except Exception as exc:
            history.append(f"{step}. action {kind} failed: {exc}")
        time.sleep(0.8)
    return {"status": "inconclusive", "reason": "step budget exhausted", "screenshots": shots, "steps_taken": history}


def learn_from_failure(case: dict, result: dict, app_name: str) -> str | None:
    """Distill a found bug into a learned skill (the recursive part)."""
    try:
        saved = skill_library.save_skill({
            "name": f"ui-{app_name}-{case.get('id', 'bug')}: {case.get('title', '')[:40]}",
            "description": f"UI bug found while testing {app_name}: {case.get('title', '')}",
            "error_signature": result.get("reason", "")[:300],
            "root_cause": f"Objective: {case.get('objective','')} — observed: {result.get('reason','')[:200]}",
            "fix_pattern": f"Regression-check this scenario first on similar apps. Expected: {case.get('expected','')}",
            "provider": "uitest",
        })
        return saved.get("slug")
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--app-name", default="webapp")
    ap.add_argument("--out", default=str(REPO_ROOT / "nvidia" / "tester" / "runs"))
    ap.add_argument("--max-cases", type=int, default=4)
    ap.add_argument("--max-steps", type=int, default=8)
    args = ap.parse_args()

    run_dir = Path(args.out) / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"planning tests for {args.url} …", file=sys.stderr)
    plan = make_plan(args.url, args.app_name, args.max_cases)
    print(f"{len(plan)} test case(s) planned", file=sys.stderr)

    from playwright.sync_api import sync_playwright

    results = []
    started = datetime.now(timezone.utc).isoformat()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        for i, case in enumerate(plan, 1):
            print(f"case {i}/{len(plan)}: {case.get('title','')}", file=sys.stderr)
            res = run_case(page, case, run_dir, i, args.max_steps, args.url)
            res["case"] = case
            if res["status"] == "fail":
                res["learned_skill"] = learn_from_failure(case, res, args.app_name)
            results.append(res)
            skydb.add_test_case({"app_id": args.app_name, "title": case.get("title", ""), "objective": case.get("objective", "")})
        browser.close()

    passed = sum(1 for r in results if r["status"] == "pass")
    failed = sum(1 for r in results if r["status"] == "fail")
    skydb.add_test_run({
        "app_id": args.app_name, "workflow": "nemotron-ui-agent",
        "status": "failed" if failed else ("passed" if passed else "inconclusive"),
        "summary": f"{passed} passed / {failed} failed / {len(results)-passed-failed} inconclusive",
        "bug": next(({"title": r["case"]["title"], "reason": r["reason"]} for r in results if r["status"] == "fail"), None),
        "started": started,
    })

    print(json.dumps({
        "url": args.url, "app": args.app_name, "run_dir": str(run_dir),
        "passed": passed, "failed": failed,
        "inconclusive": len(results) - passed - failed,
        "cases": [{
            "title": r["case"].get("title", ""), "status": r["status"], "reason": r.get("reason", ""),
            "screenshots": r.get("screenshots", []), "learned_skill": r.get("learned_skill"),
        } for r in results],
    }, indent=2))


if __name__ == "__main__":
    main()
