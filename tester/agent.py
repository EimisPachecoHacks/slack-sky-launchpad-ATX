"""Sky Launchpad autonomous UI tester — computer-use style, powered by Qwen.

Acts like a human user on a deployed web app:

  1. Qwen (qwen3.7-max on Qwen Cloud) reads the app description and
     WRITES the test cases — including "known pitfalls" retrieved from the
     learned-skills memory (Supabase pgvector), so past lessons shape new runs.
  2. For every step, a real Chromium (Playwright) page is SCREENSHOTTED and the
     Qwen vision model (qwen3.7-plus) decides the next action (click/type/verdict)
     from the pixels — no selectors, no DOM assumptions.
  3. Verdicts land in skydb (test_cases / test_runs -> Supabase). Every bug
     found is distilled into a learned skill (SKILL.md + Qwen embedding),
     which future runs retrieve — the Recursive Intelligence loop.

Every screenshot is saved under the run directory and listed in the JSON
summary printed to stdout (the Slack app uploads them with the results).

Usage:
    python tester/agent.py --url http://<app-ip> [--app-name skynotes]
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

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))          # skydb, deployer
sys.path.insert(0, str(REPO_ROOT / "project"))  # backend (Qwen on Qwen Cloud)

# Load project/.env (last occurrence wins, like dotenv) without overriding real env.
_env_file_vars = {}
for line in (REPO_ROOT / "project" / ".env").read_text().splitlines():
    m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
    if m:
        _env_file_vars[m.group(1)] = m.group(2)  # last occurrence wins, like dotenv
for _k, _v in _env_file_vars.items():
    os.environ.setdefault(_k, _v)  # real env still beats the file

from backend import llm_client  # noqa: E402  (Qwen: qwen3.7-max chat + qwen3.7-plus vision)
import skydb  # noqa: E402
from deployer import skill_library  # noqa: E402


def _json_from(text: str):
    """Parse JSON out of an LLM reply, tolerating fences, prose, and the common
    small-model malformations (single quotes, unquoted keys, trailing commas)."""
    text = re.sub(r"```(?:json)?", "", text)
    start, end = text.find("["), text.rfind("]")
    if start == -1 or (text.find("{") != -1 and text.find("{") < start):
        start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError(f"no JSON found in: {text[:200]}")
    blob = text[start:end + 1]
    try:
        return json.loads(blob)
    except Exception:
        pass
    # Repair pass for finicky small-model output.
    fixed = blob
    fixed = re.sub(r",\s*([}\]])", r"\1", fixed)            # trailing commas
    fixed = re.sub(r"([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)", r'\1"\2"\3', fixed)  # unquoted keys
    fixed = re.sub(r"'([^'\"]*)'(\s*[:,}\]])", r'"\1"\2', fixed)  # single-quoted strings
    fixed = fixed.replace("'", '"')
    return json.loads(fixed)


def make_plan(url: str, app_name: str, max_cases: int) -> list[dict]:
    """Qwen 30B writes the test plan, informed by learned skills."""
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


ACTION_PROMPT = """You are a meticulous UI test agent. You act on a real web page by choosing
one of its interactive ELEMENTS by index — not pixels — so your actions always land.

TEST CASE: {title}
OBJECTIVE: {objective}
STEPS: {steps}
EXPECTED: {expected}

VISIBLE PAGE TEXT (what the user currently sees):
{page_text}

INTERACTIVE ELEMENTS (choose by "idx"):
{elements}

ACTIONS TAKEN SO FAR:
{history}

Decide the SINGLE next action. Return ONLY a JSON object, one of:
  {{"action":"type","idx":N,"text":"...","why":"..."}}     (types text into element N)
  {{"action":"click","idx":N,"why":"..."}}                 (clicks element N)
  {{"action":"verdict","verdict":"pass","reason":"..."}}   (expected outcome confirmed)
  {{"action":"verdict","verdict":"fail","reason":"...evidence..."}}  (a bug: expected outcome violated)
Fill required fields first, then click the submit/action button, then read the VISIBLE PAGE TEXT
to judge. Give a verdict as soon as the expected outcome is confirmed OR clearly violated — do not
keep acting once you can decide. If invalid input was accepted or the wrong item was affected,
that is a bug: verdict "fail" with the evidence you see in the page text."""


_ELEMENTS_JS = """() => {
  const sel = 'input,textarea,select,button,a[href],[role=button]';
  const out = [];
  let i = 0;
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;              // skip hidden
    e.setAttribute('data-sky-idx', String(i));
    let label = (e.labels && e.labels[0] && e.labels[0].innerText) || e.getAttribute('aria-label')
      || e.placeholder || (e.tagName === 'BUTTON' || e.tagName === 'A' ? e.innerText : '')
      || e.value || e.name || '';
    out.push({ idx: i, tag: e.tagName.toLowerCase(), type: e.type || '',
               label: String(label).replace(/\\s+/g, ' ').trim().slice(0, 50),
               value: String(e.value || '').slice(0, 30) });
    i += 1;
  }
  return out;
}"""


def _page_state(page):
    """(elements list, elements-as-text, visible page text) — the reliable,
    accessibility-tree view that the text model acts on."""
    els = page.evaluate(_ELEMENTS_JS) or []
    lines = []
    for e in els:
        desc = f"[{e['idx']}] <{e['tag']}{('/'+e['type']) if e['type'] else ''}> \"{e['label'] or '(no label)'}\""
        if e["value"]:
            desc += f" (current value: \"{e['value']}\")"
        lines.append(desc)
    text = page.evaluate("() => (document.body.innerText||'').replace(/\\n{2,}/g,'\\n').slice(0,1200)")
    return els, "\n".join(lines) or "(no interactive elements)", text


def _dom_signature(page) -> str:
    """A generic 'did the page state change' fingerprint — works on any app:
    focused element + all input/textarea values + body text length."""
    try:
        return page.evaluate("""() => {
            const ae = document.activeElement;
            const vals = Array.from(document.querySelectorAll('input,textarea'))
                .map(e => (e.value||'').slice(0,40)).join('|');
            return JSON.stringify({
                tag: ae ? ae.tagName : '', val: ae ? (ae.value||'').slice(0,60) : '',
                inputs: vals, textlen: (document.body.innerText||'').length,
            });
        }""")
    except Exception:
        return ""


# Snap an imprecise (x,y) from the vision model to the nearest real interactive
# element. Keeps clicks/typing landing even when the 8B VLM's coordinates are off
# by tens of pixels — vision still decides WHAT to do; the DOM grounds WHERE.
_NEAREST_JS = """([x, y]) => {
  const sel = 'input,textarea,button,a,select,[role=button]';
  let best = null, bestD = 1e9;
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestD) { bestD = d; best = { el, cx, cy }; }
  }
  if (!best) return null;
  const e = best.el;
  return { cx: Math.round(best.cx), cy: Math.round(best.cy), dist: Math.round(bestD),
           tag: e.tagName, type: e.type||'', text: (e.innerText||e.value||e.placeholder||'').slice(0,40) };
}"""


def _snap(page, x: int, y: int):
    try:
        return page.evaluate(_NEAREST_JS, [x, y])
    except Exception:
        return None


def _click(page, x: int, y: int) -> str:
    t = _snap(page, x, y)
    if t and t["dist"] <= 120:
        page.mouse.click(t["cx"], t["cy"])
        return f"clicked {t['tag']}<{t['type']}> '{t['text']}' (snapped {t['dist']}px from ({x},{y}))"
    page.mouse.click(x, y)
    return f"clicked ({x},{y}) — no element nearby to snap to"


def _focus_and_type(page, x: int, y: int, text: str) -> str:
    """Snap to the nearest text field, focus it, type, verify the value landed."""
    t = _snap(page, x, y)
    if not t or t["tag"] not in ("INPUT", "TEXTAREA") or t["dist"] > 200:
        return f"no text field near ({x},{y}) to type into — the field is elsewhere"
    page.mouse.click(t["cx"], t["cy"])
    time.sleep(0.15)
    page.evaluate("() => { if (document.activeElement) document.activeElement.value=''; }")
    page.keyboard.type(text, delay=20)
    time.sleep(0.15)
    got = page.evaluate("() => (document.activeElement && document.activeElement.value) || ''")
    if text.strip() and text.strip()[:20] not in got:
        return f"typed {text!r} but field shows {got!r} — did not register"
    return f"typed {text!r} into {t['tag']} '{t['text']}' (confirmed: {got[:40]!r})"


def _act_on(page, idx, action, text):
    """Execute a click/type on the element with the given data-sky-idx. DOM-based,
    so it always lands. Returns a short note for the history."""
    sel = f'[data-sky-idx="{idx}"]'
    el = page.query_selector(sel)
    if not el:
        return f"element {idx} not found"
    if action == "type":
        try:
            el.fill(text)  # focuses, clears, types — reliable for inputs/textareas
        except Exception:
            el.click()
            page.keyboard.type(text, delay=15)
        got = (el.get_attribute("value") or "")[:40]
        return f"typed {text!r} into element {idx} (now: {got!r})"
    el.click()
    return f"clicked element {idx}"


def run_case(page, case: dict, run_dir: Path, case_idx: int, max_steps: int, url: str) -> dict:
    """Element-indexed agent: Qwen (text model) reads the page's interactive
    elements + visible text and chooses actions by index — reliable execution,
    with a screenshot saved every step for review/recording."""
    history: list[str] = []
    shots: list[str] = []
    page.goto(url, wait_until="load")
    time.sleep(0.6)
    for step in range(1, max_steps + 1):
        shot = run_dir / f"case{case_idx}_step{step}.png"
        page.screenshot(path=str(shot))
        shots.append(str(shot))

        _, elements, page_text = _page_state(page)
        prompt = ACTION_PROMPT.format(
            title=case.get("title", ""), objective=case.get("objective", ""),
            steps="; ".join(case.get("steps", [])), expected=case.get("expected", ""),
            page_text=page_text, elements=elements,
            history="\n".join(history) or "(none yet)",
        )
        act = None
        for attempt in (1, 2):
            try:
                act = _json_from(llm_client.chat(prompt, temperature=0.0, kind="uitest", max_tokens=1200))
                break
            except Exception as exc:
                if attempt == 2:
                    return {"status": "inconclusive", "reason": f"decision step failed: {exc}",
                            "screenshots": shots, "steps_taken": history}
                time.sleep(4)

        if act.get("action") == "verdict":
            page.screenshot(path=str(run_dir / f"case{case_idx}_final.png"))
            shots.append(str(run_dir / f"case{case_idx}_final.png"))
            return {"status": act.get("verdict", "inconclusive"), "reason": act.get("reason", ""),
                    "screenshots": shots, "steps_taken": history}
        try:
            note = _act_on(page, int(act.get("idx", -1)), act.get("action"), str(act.get("text", "")))
        except Exception as exc:
            note = f"action failed: {exc}"
        history.append(f"{step}. {note} — {act.get('why', '')}")
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
    ap.add_argument("--out", default=str(REPO_ROOT / "tester" / "runs"))
    ap.add_argument("--max-cases", type=int, default=4)
    ap.add_argument("--max-steps", type=int, default=8)
    ap.add_argument("--headed", action="store_true", help="show the browser window (for recording)")
    ap.add_argument("--slow", type=int, default=0, help="slow-motion delay in ms between actions (e.g. 800)")
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
        browser = p.chromium.launch(headless=not args.headed, slow_mo=args.slow)
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
        "app_id": args.app_name, "workflow": "qwen-ui-agent",
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
