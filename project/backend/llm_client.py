"""OpenAI-compatible client for Gemma 4 on the AMD MI300X.

Everything the app touches speaks the OpenAI wire format and is served by Ollama
on the AMD ROCm GPU, so a single client covers every capability:

  chat(...)        : text generation        -> /chat/completions
  vision_chat(...) : image analysis         -> Gemma 4 is a VLM (Ollama native API)
  transcribe(...)  : speech-to-text         -> /audio/transcriptions (Whisper on GPU)
  embed(...)       : skill-retrieval vectors-> /embeddings

Embeddings use exactly ONE model on the GPU. Vectors from different models are
not comparable, so there is no fallback embedder: when the endpoint is
unreachable, embed() returns None and skydb.find_similar_skills degrades to
lexical cosine rather than corrupting the index.

Speech-to-text points at our own Whisper shim on the GPU (services/whisper_server.py),
which is why LLM_AUDIO_BASE_URL is a separate port from LLM_BASE_URL.

Config (see backend/config.py):
  LLM_BASE_URL, LLM_MODEL, LLM_VISION_MODEL, LLM_AUDIO_BASE_URL, LLM_TRANSCRIBE_MODEL,
  EMBED_BASE_URL, EMBED_MODEL, EMBED_DIMENSIONS, EMBED_SEND_DIMENSIONS
"""

import logging
import os

logger = logging.getLogger(__name__)

# Ollama on the MI300X. gemma4:31b (Google Gemma 4, 31B dense, 256K context) is
# multimodal, and Ollama's OpenAI-compatible endpoint accepts base64 `data:`
# image URLs (remote http image URLs it does not).
OLLAMA_BASE_URL = "http://localhost:11434/v1"

_DEFAULTS = {
    "LLM_BASE_URL": OLLAMA_BASE_URL,
    "LLM_MODEL": "gemma4:31b",
    "LLM_VISION_MODEL": "gemma4:31b",
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


def _resolve(name: str) -> str:
    """Explicit setting wins; otherwise the AMD/Ollama default."""
    return _cfg(name) or _DEFAULTS.get(name, "")


def _api_key() -> str:
    # Ollama does not authenticate; an explicit LLM_API_KEY is honoured if set.
    return _cfg("LLM_API_KEY") or "EMPTY"


def _provider() -> str:
    """The inference backend. Always AMD (Gemma 4 on ROCm via Ollama)."""
    return "amd"


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
    image_format: kept for signature compatibility; Ollama infers it.

    Ollama's OpenAI-compatible endpoint ingests the image but returns EMPTY
    content for multimodal requests (finish_reason=length, 0 chars) — verified on
    gemma4:31b. Its NATIVE /api/chat with an `images:[base64]` field works, so we
    use that.
    """
    model = model or _resolve("LLM_VISION_MODEL")
    return _ollama_vision(model, image_base64, prompt, temperature, max_tokens, kind)


def _ollama_vision(model: str, image_base64: str, prompt: str,
                   temperature: float, max_tokens: int, kind: str) -> str:
    """Vision via Ollama's native /api/chat (images:[base64]). Returns text."""
    import httpx
    import time as _time

    # base is the OpenAI URL (…/v1); the native API sits at the same host, no /v1.
    base = _resolve("LLM_BASE_URL").rstrip("/")
    native = base[:-3] if base.endswith("/v1") else base
    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "user", "content": prompt, "images": [image_base64]}],
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }
    logger.info(f"[amd] {model}: {kind} (native /api/chat)")
    _t0 = _time.monotonic()
    try:
        resp = httpx.post(f"{native}/api/chat", json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        text = resp.json()["message"]["content"]
    except Exception as exc:
        _record(model, kind, (_time.monotonic() - _t0) * 1000, False, str(exc))
        raise
    _record(model, kind, (_time.monotonic() - _t0) * 1000, True, "")
    return text


def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm", kind: str = "transcribe") -> str:
    """Transcribe audio to text via Whisper on the GPU.

    Points at our own Whisper shim (services/whisper_server.py), which runs on a
    separate port from the LLM — hence LLM_AUDIO_BASE_URL.
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
