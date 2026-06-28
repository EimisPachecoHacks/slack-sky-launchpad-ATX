"""Google Gemini client for Sky Launchpad.

Two capabilities, both via the Gemini REST API (no SDK dependency required):
  - vision(...)          : image analysis            -> default gemini-3.1-pro-preview
  - transcribe_audio(...): speech-to-text for voice  -> default gemini-3.1-flash-live-preview

Replaces the previous Anthropic Claude Vision and ElevenLabs Scribe integrations.

Config (see backend/config.py):
  - GEMINI_API_KEY        : API key (required to call the model)
  - GEMINI_VISION_MODEL   : default "gemini-3.1-pro-preview"
  - GEMINI_LIVE_MODEL     : default "gemini-3.1-flash-live-preview"
"""

import base64
import logging
import os

logger = logging.getLogger(__name__)

_API_ROOT = "https://generativelanguage.googleapis.com/v1beta/models"


def _settings():
    try:
        from backend.config import settings
        return settings
    except Exception:
        return None


def _api_key() -> str:
    s = _settings()
    key = (getattr(s, "GEMINI_API_KEY", "") if s else "") or os.getenv("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set — cannot call Gemini.")
    return key


def _record(model: str, kind: str, duration_ms: float, ok: bool, error: str) -> None:
    try:
        from backend.observability import record_ai_call
        record_ai_call(model, kind, duration_ms, ok, error)
    except Exception:
        pass


def _generate_content(model: str, parts: list[dict], temperature: float = 0.2, kind: str = "vision") -> str:
    """POST a generateContent request and return the first text part."""
    import httpx
    import time as _time

    url = f"{_API_ROOT}/{model}:generateContent?key={_api_key()}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": temperature},
    }
    logger.info(f"[Gemini] {model}: generateContent ({len(parts)} part(s))")
    _t0 = _time.monotonic()
    try:
        resp = httpx.post(url, json=payload, timeout=120.0)
        resp.raise_for_status()
        data = resp.json()
        try:
            out_parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in out_parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected Gemini response shape: {data}") from exc
    except Exception as exc:
        _record(model, kind, (_time.monotonic() - _t0) * 1000, False, str(exc))
        raise
    _record(model, kind, (_time.monotonic() - _t0) * 1000, True, "")
    logger.info(f"[Gemini] received {len(text)} chars")
    return text


def vision(image_base64: str, image_format: str, prompt: str, model: str | None = None) -> str:
    """Analyze an image and return the model's text response.

    image_base64: base64-encoded image bytes (no data: prefix).
    image_format: e.g. 'png', 'jpeg'.
    """
    s = _settings()
    model = model or (getattr(s, "GEMINI_VISION_MODEL", "") if s else "") or os.getenv(
        "GEMINI_VISION_MODEL", "gemini-3.1-pro-preview"
    )
    fmt = "jpeg" if image_format.lower() in ("jpg", "jpeg") else image_format.lower()
    parts = [
        {"inline_data": {"mime_type": f"image/{fmt}", "data": image_base64}},
        {"text": prompt},
    ]
    return _generate_content(model, parts)


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/webm", model: str | None = None) -> str:
    """Transcribe audio to text via Gemini (replaces ElevenLabs Scribe).

    Note: the realtime live model (GEMINI_LIVE_MODEL) only supports the WebSocket
    bidi API, so this record-then-POST path uses a generateContent-capable flash
    model (GEMINI_TRANSCRIBE_MODEL). The live model is used for streaming narration
    in gemini_live.py.
    """
    s = _settings()
    model = model or (getattr(s, "GEMINI_TRANSCRIBE_MODEL", "") if s else "") or os.getenv(
        "GEMINI_TRANSCRIBE_MODEL", "gemini-3.1-flash-lite"
    )
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
    parts = [
        {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
        {"text": "Transcribe this audio to text. Return ONLY the transcript, no commentary."},
    ]
    return _generate_content(model, parts, kind="transcribe").strip()
