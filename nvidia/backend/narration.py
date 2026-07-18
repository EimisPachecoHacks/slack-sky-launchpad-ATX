"""Real-time narration of the self-improvement loop over a WebSocket.

Sky Launchpad runs a deploy -> detect-failure -> repair -> retry loop. As each
phase happens, the deploy loop pushes a short narration event onto an in-process
pub/sub bus. A WebSocket endpoint subscribes to that bus and streams the text to
the browser so the user watches the loop think out loud:

    "Deployment failed: Compute API disabled. Handing the logs to the Qwen
     repair agent... root cause found... writing a new skill... retrying..."

------------------------------------------------------------------------------
Audio
------------------------------------------------------------------------------
Narration is text-only: each frame carries ``audio: false`` and the browser
speaks it aloud with ``window.speechSynthesis``. So you still HEAR the loop
narrate ("deploy failed… Qwen is diagnosing… authored a skill… retrying"),
spoken by the browser's built-in voice — no server-side audio streaming needed.

------------------------------------------------------------------------------
How the deploy loop uses this module
------------------------------------------------------------------------------
The orchestrator / deploy loop only needs the convenience helper::

    from backend.narration import narrate

    narrate("deploy",  "Deploying infrastructure to GCP...")
    narrate("failure", "Deployment failed: Compute Engine API is disabled.")
    narrate("diagnose","Handing the logs to the Qwen repair agent...")
    narrate("learned", "Authored a new reusable skill from this failure.")
    narrate("retry",   "Retrying deployment...")
    narrate("success", "Deployment succeeded.")

Each call is fire-and-forget and never blocks (the bus drops events for slow /
absent subscribers rather than back-pressuring the deploy loop).

The main FastAPI app wires this in::

    from backend.narration import router as live_router
    app.include_router(live_router)
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# Per-subscriber queue depth. The bus drops the oldest events for a subscriber
# that falls behind so a slow / disconnected client can never block the deploy
# loop (publish() is non-blocking and synchronous).
_QUEUE_MAXSIZE = 256


# ---------------------------------------------------------------------------
# In-process pub/sub bus
# ---------------------------------------------------------------------------
class NarrationBus:
    """A tiny in-process fan-out bus for narration events.

    `publish` is synchronous and non-blocking so the (possibly synchronous)
    deploy loop can call it from anywhere. `subscribe` is an async generator
    intended to be consumed by the WebSocket handler.

    An event is a plain dict: ``{"phase": str, "text": str}``.
    """

    def __init__(self) -> None:
        self._subscribers: List["asyncio.Queue[Dict[str, str]]"] = []
        # Capture the loop the app runs on so publish() can be called from a
        # synchronous deploy-loop thread and still schedule onto the right loop.
        self._loop: asyncio.AbstractEventLoop | None = None

    def _ensure_loop(self) -> asyncio.AbstractEventLoop | None:
        if self._loop is None:
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                self._loop = None
        return self._loop

    def publish(self, event: Dict[str, str]) -> None:
        """Push an event to every current subscriber. Never blocks or raises."""
        if not isinstance(event, dict):
            return

        def _deliver() -> None:
            for queue in list(self._subscribers):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    # Subscriber is behind: drop the oldest event and retry once.
                    try:
                        queue.get_nowait()
                        queue.put_nowait(event)
                    except Exception:
                        pass
                except Exception:  # pragma: no cover - defensive
                    pass

        loop = self._ensure_loop()
        if loop is not None and loop.is_running():
            try:
                # Thread-safe scheduling: works whether publish() is called from
                # the event loop thread or a worker thread running the deploy loop.
                loop.call_soon_threadsafe(_deliver)
            except RuntimeError:
                _deliver()
        else:
            _deliver()

    async def subscribe(self) -> AsyncGenerator[Dict[str, str], None]:
        """Yield narration events as they are published.

        Registers a per-subscriber queue, captures the running loop for
        publish() scheduling, and unregisters on exit (e.g. WS disconnect).
        """
        self._ensure_loop()
        queue: "asyncio.Queue[Dict[str, str]]" = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._subscribers.append(queue)
        try:
            while True:
                event = await queue.get()
                yield event
        finally:
            try:
                self._subscribers.remove(queue)
            except ValueError:
                pass


# Module-level singleton used by both the deploy loop and the WS handler.
bus = NarrationBus()


def narrate(phase: str, text: str) -> None:
    """Publish one narration event. Fire-and-forget; never blocks or raises.

    Args:
        phase: short machine-friendly phase label, e.g. "failure" / "diagnose".
        text:  human narration to speak/show, e.g. "Diagnosing the failure".
    """
    bus.publish({"phase": str(phase), "text": str(text)})


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------
router = APIRouter()


@router.websocket("/api/live/narrate")
async def narrate_ws(websocket: WebSocket) -> None:
    """Stream live narration of the self-improvement loop to the browser.

    Every event becomes a JSON text frame with ``audio: false``, which tells the
    client to speak it with browser SpeechSynthesis.
    """
    await websocket.accept()

    try:
        await websocket.send_json({"type": "ready", "server_audio": False})
    except Exception:
        return

    try:
        async for event in bus.subscribe():
            text = event.get("text", "")
            if not text:
                continue

            await websocket.send_json(
                {
                    "type": "narration",
                    "phase": event.get("phase", ""),
                    "text": text,
                    "audio": False,  # browser speaks it
                }
            )
    except WebSocketDisconnect:
        return
    except Exception as exc:  # never crash the socket on unexpected errors
        logger.warning("narrate_ws terminating: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass


@router.get("/api/live/health")
def live_health() -> Dict[str, object]:
    """Narration is text-only; the browser synthesizes speech."""
    return {"server_audio": False, "transport": "websocket-text"}
