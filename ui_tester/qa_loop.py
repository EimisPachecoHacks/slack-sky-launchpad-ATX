"""Continuous autonomous QA loop for Sky Launchpad.

Periodically runs a set of natural-language UI workflows through the
self-test backend (which drives the local Playwright client) and logs each run
to MongoDB Atlas (via the backend). Keeps the Apps/Learning dashboards live.

Env:
  QA_STREAM_WS        WebSocket stream endpoint
                      (default: wss://sky-backend-330741023262.us-central1.run.app/api/uitest/stream)
  QA_TARGET_URL       app under test (default: http://localhost:3001)
  QA_INTERVAL_SECONDS seconds between suite runs (default: 1800 = 30 min)

Run:  python ui_tester/qa_loop.py     (Ctrl+C to stop)
Stop: pkill -f ui_tester/qa_loop.py
"""

import asyncio
import json
import os
import ssl
from datetime import datetime, timezone

import websockets

try:
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL = ssl.create_default_context()

STREAM_WS = os.getenv(
    "QA_STREAM_WS",
    "wss://sky-backend-330741023262.us-central1.run.app/api/uitest/stream",
)
TARGET_URL = os.getenv("QA_TARGET_URL", "http://localhost:3001")
INTERVAL = int(os.getenv("QA_INTERVAL_SECONDS", "1800"))
# On a failed workflow, auto-invoke the fix agent (diagnose -> GitLab MR / dry-run
# -> learned skill). Real MRs require GITLAB_TOKEN on the backend; otherwise dry-run.
AUTOFIX = os.getenv("QA_AUTOFIX", "1") == "1"
# HTTP base for the fix endpoint, derived from the WS stream URL unless overridden.
API_URL = os.getenv(
    "QA_API_URL",
    STREAM_WS.replace("wss://", "https://").replace("ws://", "http://").replace("/api/uitest/stream", ""),
)

# Keep the default suite small to bound token cost; expand as needed.
WORKFLOWS = [
    "Open the app and verify the Sky Launchpad landing page renders with navigation and no error screen.",
    "Use the navigation to open another page (e.g. Features or Pricing) and confirm its content loads without errors.",
]


async def _run(workflow: str) -> dict:
    use_ssl = _SSL if STREAM_WS.startswith("wss://") else None
    async with websockets.connect(STREAM_WS, ssl=use_ssl, max_size=None) as ws:
        await ws.send(json.dumps({"type": "run", "workflow": workflow, "target_url": TARGET_URL}))
        verdict, bug, summary = "inconclusive", None, ""
        while True:
            try:
                m = json.loads(await asyncio.wait_for(ws.recv(), timeout=180))
            except asyncio.TimeoutError:
                return {"verdict": "timeout", "bug": None, "summary": ""}
            if m.get("kind") == "verdict":
                verdict = m.get("verdict", verdict)
                bug = m.get("bug")
                summary = m.get("summary", "")
            elif m.get("kind") == "done":
                break
        return {"verdict": verdict, "bug": bug, "summary": summary}


def _autofix(workflow: str, result: dict) -> None:
    """On a failed run, ask the fix agent to diagnose + open a GitLab MR (or dry-run)."""
    bug = result.get("bug") or {}
    payload = {"bug": {
        **bug,
        "workflow": workflow,
        "target_url": TARGET_URL,
        "summary": result.get("summary", ""),
    }}
    try:
        import httpx
        r = httpx.post(f"{API_URL}/api/uitest/fix", json=payload, timeout=200.0)
        d = r.json()
        mr = d.get("mr_url") or d.get("note") or "(no MR)"
        print(f"     🛠️  auto-fix: {(d.get('solution') or d.get('error') or '')[:90]} | {mr}")
    except Exception as exc:  # noqa: BLE001
        print(f"     🛠️  auto-fix failed: {exc}")


async def run_suite() -> None:
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"\n[{stamp}] QA suite ({len(WORKFLOWS)} workflows) → {TARGET_URL}")
    for wf in WORKFLOWS:
        try:
            result = await _run(wf)
        except Exception as exc:  # noqa: BLE001
            result = {"verdict": f"error: {exc}", "bug": None, "summary": ""}
        v = result["verdict"]
        mark = "✅" if v == "pass" else ("❌" if v == "fail" else "⚠️")
        print(f"  {mark} {v:12} | {wf[:70]}")
        if v == "fail" and AUTOFIX:
            _autofix(wf, result)


async def main() -> None:
    print(f"QA loop started. Endpoint={STREAM_WS} interval={INTERVAL}s. Ctrl+C to stop.")
    while True:
        try:
            await run_suite()
        except Exception as exc:  # noqa: BLE001
            print(f"  suite error: {exc}")
        await asyncio.sleep(INTERVAL)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nQA loop stopped.")
