"""Unified OpenAI-compatible LLM client for Sky Launchpad.

Every model this app touches now speaks the OpenAI wire format, so a single
client fronts two interchangeable backends selected by LLM_PROVIDER:

  amd       : Ollama (or vLLM) serving Gemma 3 on an AMD ROCm GPU (MI300X).
              Ollama is the default because the hackathon pod is a managed
              JupyterLab container where `docker run` is unavailable, and
              Ollama installs as a plain process with a bundled ROCm runtime.
  fireworks : Fireworks AI managed API (also AMD-hosted), an optional fallback

Capabilities:
  chat(...)        : text generation        -> /chat/completions
  vision_chat(...) : image analysis         -> /chat/completions (Gemma 3 is a VLM)
  transcribe(...)  : speech-to-text         -> /audio/transcriptions (Whisper)
  embed(...)       : skill-retrieval vectors-> /embeddings

Embeddings are deliberately NOT provider-switchable. Vectors from different
models are not comparable, so mixing providers would silently corrupt the
Atlas index. One 1024-d embedder, served on the AMD GPU, owns the index; when
it is unreachable, embed() returns None and skydb.find_similar_skills degrades
to lexical cosine.

Speech-to-text points at our own Whisper shim on the GPU (services/whisper_server.py),
which is why LLM_AUDIO_BASE_URL is separate from LLM_BASE_URL.

Config (see backend/config.py):
  LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL, LLM_VISION_MODEL,
  LLM_AUDIO_BASE_URL, LLM_TRANSCRIBE_MODEL,
  EMBED_BASE_URL, EMBED_API_KEY, EMBED_MODEL, EMBED_DIMENSIONS, EMBED_SEND_DIMENSIONS
"""

import logging
import os

logger = logging.getLogger(__name__)

FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1"
FIREWORKS_AUDIO_BASE_URL = "https://audio-prod.us-virginia-1.direct.fireworks.ai/v1"

# Ollama on the MI300X. gemma3:12b is multimodal, and Ollama's OpenAI-compatible
# endpoint accepts base64 `data:` image URLs (remote http image URLs it does not).
OLLAMA_BASE_URL = "http://localhost:11434/v1"

# Per-provider defaults, overridden by any explicit LLM_*/EMBED_* setting.
_PROVIDER_DEFAULTS = {
    "fireworks": {
        "LLM_BASE_URL": FIREWORKS_BASE_URL,
        "LLM_MODEL": "accounts/fireworks/models/gemma-3-27b-it",
        "LLM_VISION_MODEL": "accounts/fireworks/models/gemma-3-27b-it",
    },
    "amd": {
        "LLM_BASE_URL": OLLAMA_BASE_URL,
        "LLM_MODEL": "gemma3:12b",
        "LLM_VISION_MODEL": "gemma3:12b",
    },
}

_TIMEOUT = 120.0


def _settings():
    try:
        from backend.config import settings
        return settings
    except Exception:  # allow use outside the FastAPI app (e.g. scripts/tests)
        return None


def _cfg(name: str, default: str = "") -> str:
    s = _settings()
    return (getattr(s, name, "") if s else "") or os.getenv(name, "") or default


def _provider() -> str:
    p = _cfg("LLM_PROVIDER", "fireworks").strip().lower()
    return p if p in _PROVIDER_DEFAULTS else "fireworks"


def _resolve(name: str) -> str:
    """Explicit setting wins; otherwise fall back to the provider's default."""
    return _cfg(name) or _PROVIDER_DEFAULTS[_provider()].get(name, "")


def _api_key() -> str:
    key = _cfg("LLM_API_KEY") or _cfg("FIREWORKS_API_KEY")
    if key:
        return key
    if _provider() == "amd":
        return "EMPTY"  # vLLM does not authenticate by default
    raise RuntimeError(
        "LLM_API_KEY (or FIREWORKS_API_KEY) is not set — cannot call Fireworks."
    )


def _record(model: str, kind: str, duration_ms: float, ok: bool, error: str) -> None:
    try:
        from backend.observability import record_ai_call
        record_ai_call(model, kind, duration_ms, ok, error)
    except Exception:
        pass


def _post_chat(model: str, messages: list[dict], temperature: float, max_tokens: int, kind: str) -> str:
    import httpx
    import time as _time

    base_url = _resolve("LLM_BASE_URL").rstrip("/")
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }

    logger.info(f"[{_provider()}] {model}: {kind}")
    _t0 = _time.monotonic()
    try:
        resp = httpx.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected chat response shape: {data}") from exc
    except Exception as exc:
        _record(model, kind, (_time.monotonic() - _t0) * 1000, False, str(exc))
        raise
    _record(model, kind, (_time.monotonic() - _t0) * 1000, True, "")
    logger.info(f"[{_provider()}] received {len(text)} chars")
    return text


def chat(
    prompt: str,
    system: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    kind: str = "architecture",
) -> str:
    """Send a chat completion and return the assistant text.

    Raises RuntimeError if no API key is configured, or on a transport/HTTP error.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return _post_chat(_resolve("LLM_MODEL"), messages, temperature, max_tokens, kind)


def vision_chat(
    image_base64: str,
    image_format: str,
    prompt: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    kind: str = "vision",
) -> str:
    """Analyze an image with a VLM and return the model's text response.

    image_base64: base64-encoded image bytes (no data: prefix).
    image_format: e.g. 'png', 'jpeg'.
    """
    fmt = "jpeg" if image_format.lower() in ("jpg", "jpeg") else image_format.lower()
    messages = [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/{fmt};base64,{image_base64}"}},
            {"type": "text", "text": prompt},
        ],
    }]
    return _post_chat(model or _resolve("LLM_VISION_MODEL"), messages, temperature, max_tokens, kind)


def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm", kind: str = "transcribe") -> str:
    """Transcribe audio to text via Whisper.

    Points at our own Whisper shim on the GPU by default (services/whisper_server.py).
    Fireworks serves audio from a different origin than /chat/completions, which is
    why this base URL is configured separately either way.
    """
    import httpx
    import time as _time

    base_url = _cfg("LLM_AUDIO_BASE_URL", "http://localhost:8100/v1").rstrip("/")
    model = _cfg("LLM_TRANSCRIBE_MODEL", "openai/whisper-large-v3")

    logger.info(f"[audio] {model}: transcribing {len(audio_bytes)} bytes")
    _t0 = _time.monotonic()
    try:
        resp = httpx.post(
            f"{base_url}/audio/transcriptions",
            headers={"Authorization": f"Bearer {_api_key()}"},
            files={"file": ("audio", audio_bytes, mime_type)},
            data={"model": model, "response_format": "json"},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        text = resp.json()["text"]
    except Exception as exc:
        _record(model, kind, (_time.monotonic() - _t0) * 1000, False, str(exc))
        raise
    _record(model, kind, (_time.monotonic() - _t0) * 1000, True, "")
    return text.strip()


def embed(text: str) -> list[float] | None:
    """Embed a string for skill retrieval. Returns None on any failure.

    Callers treat None as "vector search unavailable" and fall back to lexical
    matching, so this never raises.
    """
    if not text:
        return None

    base_url = _cfg("EMBED_BASE_URL", "http://localhost:11434/v1").rstrip("/")
    model = _cfg("EMBED_MODEL", "mxbai-embed-large")
    key = _cfg("EMBED_API_KEY") or _cfg("LLM_API_KEY") or "EMPTY"

    payload = {"model": model, "input": text[:8000]}
    # `dimensions` only means anything for Matryoshka models served by a layer that
    # forwards it. bge-large rejects it; Ollama's OpenAI shim ignores it. Off by
    # default — our models emit their native 1024-d, which is what Atlas expects.
    if str(_cfg("EMBED_SEND_DIMENSIONS", "")).lower() in ("1", "true", "yes"):
        payload["dimensions"] = int(_cfg("EMBED_DIMENSIONS", "1024"))

    try:
        import httpx
        resp = httpx.post(
            f"{base_url}/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]
    except Exception as exc:
        logger.warning("embed() failed (%s); retrieval will fall back to lexical", exc)
        return None
