"""FastAPI router bridging the browser UI, the (retired) autonomous driver, and the
local Playwright client for "Sky Launchpad".

Three parties talk through this router:

1. The local Playwright client (a separate process) connects as a WS client to
   ``/api/uitest/playwright``. We keep a single module-level reference to the
   active client websocket (last connection wins).
2. The browser UI (the React Self-Test panel) connects to ``/api/uitest/stream``
   to start a run and watch it live.
3. The autonomous driver (``run_workflow``, now retired) was invoked by us; we hand it the
   ``execute_action`` / ``request_screenshot`` callbacks (which proxy to the
   Playwright client socket) and ``emit`` (which forwards events to the watching
   browser UI).

Runs are serialized (one at a time) via an ``asyncio.Lock`` so the single
request/response Playwright socket only ever has one in-flight exchange.
"""

from __future__ import annotations

import asyncio
import base64
import logging
import os
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uitest", tags=["uitest"])

# ---------------------------------------------------------------------------
# Module-level shared state
# ---------------------------------------------------------------------------

# The currently-connected local Playwright client socket (last one wins).
_playwright_ws: Optional[WebSocket] = None
playwright_connected: bool = False

# Single-reader inbox: the /playwright endpoint is the ONLY coroutine that reads
# the client socket; it puts every incoming message here. A run consumes replies
# from this queue (runs are serialized, and the client only ever speaks in reply
# to a request, so reply ordering is 1:1).
_pw_inbox: "Optional[asyncio.Queue[dict]]" = None

# Only one run may execute at a time: it owns the Playwright socket for the
# duration and does strict send-then-receive request/response correlation.
_run_lock = asyncio.Lock()

DEFAULT_TARGET_URL = "http://localhost:3001"


def _model_id() -> str:
    """The model behind /api/uitest/fix (bug repair)."""
    from backend.llm_client import _resolve

    return _resolve("LLM_MODEL")


# ---------------------------------------------------------------------------
# Playwright client socket
# ---------------------------------------------------------------------------


@router.websocket("/playwright")
async def playwright_endpoint(websocket: WebSocket) -> None:
    """The local Playwright client connects here.

    We keep a single module-level reference to the active client socket; the
    most recent connection wins. The flag ``playwright_connected`` tracks
    availability for the ``/health`` and ``/stream`` endpoints.
    """
    global _playwright_ws, playwright_connected, _pw_inbox

    await websocket.accept()
    _playwright_ws = websocket
    _pw_inbox = asyncio.Queue()
    playwright_connected = True
    logger.info("Playwright client connected")

    try:
        # This is the SINGLE reader of the client socket. Every message the
        # client sends (screenshot / action_result / started) is pushed onto the
        # inbox queue, which the active run consumes. This avoids two coroutines
        # ever calling receive on the same socket concurrently.
        while True:
            msg = await websocket.receive_json()
            await _pw_inbox.put(msg)
    except WebSocketDisconnect:
        logger.info("Playwright client disconnected")
    except Exception:  # noqa: BLE001 - never let this crash the server
        logger.exception("Playwright client socket error")
    finally:
        # Only clear if this socket is still the active one (a newer client may
        # have replaced us already).
        if _playwright_ws is websocket:
            _playwright_ws = None
            playwright_connected = False
            _pw_inbox = None


# ---------------------------------------------------------------------------
# Browser UI stream socket
# ---------------------------------------------------------------------------


@router.websocket("/stream")
async def stream_endpoint(stream_ws: WebSocket) -> None:
    """The browser UI connects here to start a run and watch it live.

    Expected trigger message from the frontend::

        {"type": "run",
         "workflow": "<natural-language QA goal>",
         "target_url": "http://localhost:3001"}  # optional, this is the default
    """
    await stream_ws.accept()

    try:
        while True:
            try:
                message = await stream_ws.receive_json()
            except WebSocketDisconnect:
                logger.info("Stream client disconnected")
                return

            if not isinstance(message, dict) or message.get("type") != "run":
                await _safe_send(
                    stream_ws,
                    {
                        "kind": "status",
                        "text": "Expected {'type':'run','workflow':...}. Ignoring message.",
                    },
                )
                continue

            workflow = message.get("workflow") or ""
            target_url = message.get("target_url") or DEFAULT_TARGET_URL

            if not workflow or not isinstance(workflow, str):
                await _safe_send(
                    stream_ws,
                    {"kind": "status", "text": "Missing 'workflow' prompt string."},
                )
                await _safe_send(
                    stream_ws,
                    {
                        "kind": "verdict",
                        "verdict": "inconclusive",
                        "summary": "No workflow prompt provided.",
                        "bug": None,
                    },
                )
                await _safe_send(stream_ws, {"kind": "done"})
                continue

            await _handle_run(stream_ws, workflow, target_url)
    except WebSocketDisconnect:
        logger.info("Stream client disconnected")
    except Exception:  # noqa: BLE001 - never let the socket crash the server
        logger.exception("Stream endpoint error")
        await _safe_send(
            stream_ws,
            {"kind": "status", "text": "Internal error in self-test stream."},
        )


async def _handle_run(stream_ws: WebSocket, workflow: str, target_url: str) -> None:
    """Execute a single self-test run, forwarding events to ``stream_ws``."""

    # 1. No Playwright client -> inconclusive, stop.
    if not playwright_connected or _playwright_ws is None:
        await _safe_send(
            stream_ws,
            {
                "kind": "status",
                "text": "No Playwright client connected. Run: python ui_tester/playwright_client.py",
            },
        )
        await _safe_send(
            stream_ws,
            {
                "kind": "verdict",
                "verdict": "inconclusive",
                "summary": "No Playwright client connected.",
                "bug": None,
            },
        )
        await _safe_send(stream_ws, {"kind": "done"})
        return

    # Serialize runs: only one may use the single Playwright socket at a time.
    if _run_lock.locked():
        await _safe_send(
            stream_ws,
            {
                "kind": "status",
                "text": "A self-test run is already in progress. Please wait.",
            },
        )
        await _safe_send(
            stream_ws,
            {
                "kind": "verdict",
                "verdict": "inconclusive",
                "summary": "Another run is in progress.",
                "bug": None,
            },
        )
        await _safe_send(stream_ws, {"kind": "done"})
        return

    async with _run_lock:
        # Pin the socket we will use for the entire run.
        pw_ws = _playwright_ws
        if pw_ws is None:
            await _safe_send(
                stream_ws,
                {"kind": "status", "text": "Playwright client dropped before start."},
            )
            await _safe_send(
                stream_ws,
                {
                    "kind": "verdict",
                    "verdict": "inconclusive",
                    "summary": "Playwright client unavailable.",
                    "bug": None,
                },
            )
            await _safe_send(stream_ws, {"kind": "done"})
            return

        # --- Callbacks proxying to the Playwright socket (strict req/resp) ---

        async def request_screenshot() -> bytes:
            await pw_ws.send_json({"type": "request_screenshot"})
            reply = await _recv_pw()
            return base64.b64decode(reply["screenshot"])

        async def execute_action(function_name: str, args: dict) -> dict:
            await pw_ws.send_json(
                {
                    "type": "execute_action",
                    "function_name": function_name,
                    "args": args,
                }
            )
            reply = await _recv_pw(timeout=90.0)
            return {
                "screenshot": base64.b64decode(reply["screenshot"]),
                "url": reply.get("url"),
                "console_errors": reply.get("console_errors", []),
            }

        async def emit(event: dict) -> None:
            await stream_ws.send_json(event)

        # Tell the Playwright client a run is starting (best-effort handshake).
        try:
            await pw_ws.send_json({"type": "start", "url": target_url})
            await _recv_pw(timeout=60.0)  # expect {"type":"started",...}
        except Exception:  # noqa: BLE001
            logger.exception("Playwright start handshake failed")
            await _safe_send(
                stream_ws,
                {
                    "kind": "status",
                    "text": "Failed to start the Playwright client session.",
                },
            )
            await _safe_send(
                stream_ws,
                {
                    "kind": "verdict",
                    "verdict": "inconclusive",
                    "summary": "Playwright start handshake failed.",
                    "bug": None,
                },
            )
            await _safe_send(stream_ws, {"kind": "done"})
            return

        # --- Drive the workflow ---
        #
        # The autonomous vision-action driver was retired with the move to a
        # fully open stack: no OpenAI-compatible provider serves a
        # computer-use-tuned model, and Qwen is not grounded for pixel-level
        # click targeting. Bug *discovery* is now the operator's job (drive the
        # app with ui_tester/playwright_client.py); bug *repair* is still
        # autonomous via POST /api/uitest/fix.
        try:
            from backend.uitest.computer_use_agent import run_workflow

            result = await run_workflow(
                workflow,
                target_url=target_url,
                request_screenshot=request_screenshot,
                execute_action=execute_action,
                emit=emit,
            )
            _persist_test_run(workflow, target_url, result)
        except ImportError:
            await _safe_send(
                stream_ws,
                {
                    "kind": "status",
                    "text": (
                        "Autonomous UI driving is not available in the open stack. "
                        "Drive the app with ui_tester/playwright_client.py, then "
                        "POST the observed bug to /api/uitest/fix."
                    ),
                },
            )
            await _safe_send(
                stream_ws,
                {
                    "kind": "verdict",
                    "verdict": "inconclusive",
                    "summary": "Computer-Use driver retired; use the Playwright client + /fix.",
                    "bug": None,
                },
            )
        except WebSocketDisconnect:
            # Either the browser or the Playwright socket dropped mid-run.
            logger.info("Socket disconnected during run")
        except Exception as exc:  # noqa: BLE001 - never crash the socket
            logger.exception("Self-test run failed")
            await _safe_send(
                stream_ws,
                {"kind": "status", "text": f"Run failed: {exc}"},
            )
            await _safe_send(
                stream_ws,
                {
                    "kind": "verdict",
                    "verdict": "inconclusive",
                    "summary": f"Run crashed: {exc}",
                    "bug": None,
                },
            )
        finally:
            # The agent emits its own final verdict; we always cap with a done.
            await _safe_send(stream_ws, {"kind": "done"})


# ---------------------------------------------------------------------------
# HTTP endpoints
# ---------------------------------------------------------------------------


@router.get("/health")
async def health() -> dict:
    return {"playwright_connected": playwright_connected, "model": _model_id()}


@router.get("/workflows")
async def workflows() -> list:
    try:
        from backend.uitest.computer_use_agent import SAMPLE_WORKFLOWS

        return SAMPLE_WORKFLOWS
    except ImportError:
        return []


_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


@router.post("/fix")
async def fix(payload: dict) -> dict:
    """Autonomous fix for a failed UI workflow (Phase 2).

    Body: {"bug": {"workflow","error"|"signal","console_errors","target_url","summary"},
           "apply": bool (optional; default env APPLY_FIX)}.
    Runs the Qwen fix agent → opens a GitLab MR (or dry-run) → records the
    solution on the app's latest failed run and saves a learned skill. If apply is set,
    also writes the patch + redeploys locally (re-verify by re-running the self-test).
    """
    bug = payload.get("bug") or {}
    apply_fix = bool(payload.get("apply", os.getenv("APPLY_FIX", "") == "1"))
    target_url = bug.get("target_url", "")

    try:
        from backend.uitest.fix_agent import diagnose_and_fix
        result = await diagnose_and_fix(bug, repo_root=_REPO_ROOT, apply=apply_fix)
    except Exception as exc:  # noqa: BLE001
        logger.exception("fix agent failed")
        return {"ok": False, "error": str(exc)}

    redeploy_result = None
    if apply_fix and not result.get("error") and result.get("files_changed"):
        try:
            from backend.uitest.redeploy import redeploy
            redeploy_result = redeploy()
        except Exception as exc:  # noqa: BLE001
            redeploy_result = {"ok": False, "detail": str(exc)}

    # Record the solution on the app's latest failed run + persist a learned skill.
    root_cause = result.get("root_cause", "")
    solution = result.get("solution", "")
    mr_url = result.get("mr_url", "")
    error_sig = bug.get("error") or bug.get("signal") or bug.get("summary") or "UI workflow failure"
    try:
        import skydb
        app = next((a for a in skydb.list_apps() if a.get("url") and a["url"] == target_url), None)
        run = skydb.latest_test_run(app["app_id"]) if app else None
        if run:
            skydb.add_test_run({
                **run, "run_id": None, "solution": solution, "mr_url": mr_url,
                "status": run.get("status", "failed"),
            })
    except Exception:
        pass
    try:
        import deployer.skill_library as sl
        sl.save_skill({
            "name": f"ui-{_slug(error_sig)}",
            "description": (solution or root_cause or error_sig)[:160],
            "error_signature": error_sig,
            "root_cause": root_cause,
            "fix_pattern": solution,
            "provider": "ui",
        })
    except Exception:
        pass

    return {
        "ok": not result.get("error"),
        "root_cause": root_cause,
        "solution": solution,
        "files_changed": result.get("files_changed", []),
        "mr_url": mr_url,
        "applied": result.get("applied", False),
        "redeploy": redeploy_result,
        "note": result.get("note", ""),
        "error": result.get("error", ""),
    }


def _slug(text: str) -> str:
    import re as _re
    s = _re.sub(r"[^a-z0-9]+", "-", (text or "fix").lower()).strip("-")
    return (s[:40] or "fix")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _persist_test_run(workflow: str, target_url: str, result: Optional[dict]) -> None:
    """Record a self-test run in skydb, linking to the app by URL. Best-effort."""
    if not isinstance(result, dict):
        return
    try:
        import skydb

        app = next((a for a in skydb.list_apps() if a.get("url") and a["url"] == target_url), None)
        verdict = result.get("verdict")
        status = {"pass": "passed", "fail": "failed"}.get(verdict, "inconclusive")
        bug = result.get("bug") or {}
        skydb.add_test_run({
            "app_id": app["app_id"] if app else None,
            "target_url": target_url,
            "workflow": workflow,
            "status": status,
            "summary": result.get("summary", ""),
            "bug": bug or None,
            "error": bug.get("signal", "") if status == "failed" else "",
            "solution": "",   # populated by the Phase 2 fix agent when it resolves the bug
            "mr_url": "",
        })
    except Exception as exc:  # noqa: BLE001
        logger.debug("persist test_run skipped: %s", exc)


async def _recv_pw(timeout: float = 30.0) -> dict:
    """Await the next message from the Playwright client (via the single-reader inbox)."""
    if _pw_inbox is None:
        raise RuntimeError("Playwright client not connected")
    return await asyncio.wait_for(_pw_inbox.get(), timeout=timeout)


async def _safe_send(ws: WebSocket, payload: dict) -> None:
    """Send JSON, swallowing errors if the socket is already gone."""
    try:
        await ws.send_json(payload)
    except Exception:  # noqa: BLE001
        logger.debug("Failed to send on closed socket: %s", payload.get("kind"))
