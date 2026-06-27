"""Real-time voice narration of the self-improvement loop via Gemini Live API.

Sky Launchpad runs a deploy -> detect-failure -> repair -> retry loop. As each
phase happens, the deploy loop pushes a short narration event onto an in-process
pub/sub bus. A WebSocket endpoint subscribes to that bus and streams the text
(and, when the Gemini Live SDK + API key are available, low-latency speech audio)
to the browser so the user hears the loop think out loud:

    "Deployment failed: Compute API disabled. Spinning up the Antigravity repair
     agent... root cause found... writing a new skill... retrying... success."

------------------------------------------------------------------------------
How the deploy loop uses this module
------------------------------------------------------------------------------
The orchestrator / deploy loop only needs the convenience helper::

    from backend.gemini_live import narrate

    narrate("deploy",  "Deploying infrastructure to GCP...")
    narrate("failure", "Deployment failed: Compute Engine API is disabled.")
    narrate("repair",  "Spinning up the Antigravity repair agent...")
    narrate("analyze", "Root cause found: missing API enablement.")
    narrate("skill",   "Writing a new skill to enable the API and retry.")
    narrate("retry",   "Retrying deployment...")
    narrate("success", "Deployment succeeded.")

Each call is fire-and-forget and never blocks (the bus drops events for slow /
absent subscribers rather than back-pressuring the deploy loop).

The main FastAPI app wires this in (no existing file is modified by this module)::

    from backend.gemini_live import router as live_router
    app.include_router(live_router)

------------------------------------------------------------------------------
Gemini Live API call shape (documented, lazily imported)
------------------------------------------------------------------------------
This module targets the `google-genai` SDK live API. The assumed shape, based on
that SDK, is::

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)
    config = types.LiveConnectConfig(response_modalities=["AUDIO"])
    async with client.aio.live.connect(model=GEMINI_LIVE_MODEL, config=config) as session:
        await session.send_client_content(
            turns=types.Content(role="user", parts=[types.Part(text="<narration>")]),
            turn_complete=True,
        )
        async for response in session.receive():
            if response.data:               # raw PCM audio bytes
                ...                          # forward to client as binary WS frame
            if response.server_content and response.server_content.turn_complete:
                break

If `google-genai` is not importable, or `GEMINI_API_KEY` is unset, or any error
occurs mid-stream, we fall back to sending only the JSON text frame so the
browser can speak it with `window.speechSynthesis`. The socket is never crashed.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import AsyncGenerator, Dict, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
GEMINI_LIVE_MODEL: str = "gemini-3.5-live-preview"

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
    """Convenience wrapper: publish a narration event onto the global bus.

    Args:
        phase: short machine-friendly phase label, e.g. "failure" / "repair".
        text:  human narration to speak/show, e.g. "Spinning up the repair agent".
    """
    bus.publish({"phase": str(phase), "text": str(text)})


# ---------------------------------------------------------------------------
# Gemini Live streaming (lazy import, graceful degradation)
# ---------------------------------------------------------------------------
async def _stream_gemini_audio(websocket: WebSocket, text: str) -> bool:
    """Stream TTS audio for ``text`` from Gemini Live to the client.

    Returns True if audio was streamed successfully, False if the SDK / key is
    unavailable or any error occurred (caller then relies on the text frame /
    browser SpeechSynthesis fallback). Never raises.
    """
    if not GEMINI_API_KEY:
        return False

    try:
        # Lazy import: keep this module importable even without google-genai.
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
    except Exception as exc:  # ImportError or partial install
        logger.debug("google-genai unavailable, falling back to text: %s", exc)
        return False

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        config = types.LiveConnectConfig(response_modalities=["AUDIO"])

        async with client.aio.live.connect(
            model=GEMINI_LIVE_MODEL, config=config
        ) as session:
            # Ask the model to speak the narration verbatim.
            await session.send_client_content(
                turns=types.Content(
                    role="user",
                    parts=[types.Part(text=f"Say this aloud verbatim: {text}")],
                ),
                turn_complete=True,
            )

            streamed_any = False
            async for response in session.receive():
                data = getattr(response, "data", None)
                if data:
                    # Raw PCM audio chunk -> binary WS frame.
                    await websocket.send_bytes(data)
                    streamed_any = True

                server_content = getattr(response, "server_content", None)
                if server_content is not None and getattr(
                    server_content, "turn_complete", False
                ):
                    break

            return streamed_any
    except Exception as exc:  # network / SDK / model errors
        logger.warning("Gemini Live streaming failed, using text fallback: %s", exc)
        return False


# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------
router = APIRouter()


@router.websocket("/api/live/narrate")
async def narrate_ws(websocket: WebSocket) -> None:
    """Stream live narration of the self-improvement loop to the browser.

    For every event published on the bus we always send a JSON text frame so the
    client can render / speak it. When Gemini Live is available we additionally
    stream binary PCM audio frames before the text frame. The audio-availability
    is announced once on connect so the client knows whether to fall back to
    browser SpeechSynthesis.
    """
    await websocket.accept()

    # Announce capabilities so the client can decide on its SpeechSynthesis fallback.
    try:
        await websocket.send_json(
            {
                "type": "ready",
                "gemini_live": bool(GEMINI_API_KEY),
                "model": GEMINI_LIVE_MODEL,
            }
        )
    except Exception:
        return

    try:
        async for event in bus.subscribe():
            phase = event.get("phase", "")
            text = event.get("text", "")
            if not text:
                continue

            # 1) Try to stream low-latency audio (no-op/False if unavailable).
            audio_ok = await _stream_gemini_audio(websocket, text)

            # 2) Always send the text frame. `audio` tells the client whether
            #    audio was already streamed (skip SpeechSynthesis) or not
            #    (speak the text in the browser).
            await websocket.send_json(
                {
                    "type": "narration",
                    "phase": phase,
                    "text": text,
                    "audio": bool(audio_ok),
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
    """Report whether Gemini Live audio is configured."""
    return {"gemini_live": bool(GEMINI_API_KEY), "model": GEMINI_LIVE_MODEL}
