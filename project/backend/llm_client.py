"""OpenAI-compatible client for Qwen models on Qwen Cloud (Alibaba Model Studio).

Everything the app touches speaks the OpenAI wire format and is served by Qwen
Cloud's compatible endpoint, so a single client covers every capability:

  chat(...)        : text generation / reasoning -> qwen3.7-max
  vision_chat(...) : image analysis (VLM)        -> qwen3.7-plus (text + vision)
  transcribe(...)  : speech-to-text              -> Qwen-ASR (DashScope)
  embed(...)       : skill-retrieval vectors      -> text-embedding-v4 (1024-d)

All of these hit the same OpenAI-compatible base URL with the same
DASHSCOPE_API_KEY, so switching models is just a model-name change.

Embeddings use exactly ONE model. Vectors from different models are not
comparable, so there is no fallback embedder: when the endpoint is unreachable
embed() returns None and skydb.find_similar_skills degrades to lexical cosine
rather than corrupting the index.

Endpoint note (from the Qwen Cloud quickstart): the API-key prefix must match
the base URL. Pay-as-you-go keys (sk-...) use dashscope-intl...; Token-Plan keys
(sk-sp-...) use token-plan.ap-southeast-1...; mixing them returns 401. Set
LLM_BASE_URL to the matching URL if you use a Token-Plan key.

Config (see backend/config.py):
  LLM_BASE_URL, LLM_MODEL, LLM_VISION_MODEL, LLM_AUDIO_BASE_URL, LLM_TRANSCRIBE_MODEL,
  EMBED_BASE_URL, EMBED_MODEL, EMBED_DIMENSIONS, EMBED_SEND_DIMENSIONS
"""

import logging
import os

logger = logging.getLogger(__name__)

# Qwen Cloud (Alibaba Cloud Model Studio) OpenAI-compatible endpoint. The
# international, pay-as-you-go base URL; override LLM_BASE_URL for Token-Plan
# (token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1).
QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

_DEFAULTS = {
    "LLM_BASE_URL": QWEN_BASE_URL,
    "LLM_MODEL": "qwen3.7-max",      # text + reasoning, the agent brain
    "LLM_VISION_MODEL": "qwen3.7-plus",  # text + vision (diagrams, computer-use)
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
    """Explicit setting wins; otherwise the Qwen Cloud default."""
    return _cfg(name) or _DEFAULTS.get(name, "")


def _api_key() -> str:
    # Qwen Cloud authenticates with a DashScope API key.
    return _cfg("DASHSCOPE_API_KEY") or _cfg("LLM_API_KEY") or "EMPTY"


def _provider() -> str:
    """The inference backend. Always Qwen Cloud (Alibaba Model Studio)."""
    return "qwen"


def _record(model: str, kind: str, duration_ms: float, ok: bool, error: str) -> None:
    try:
        from backend.observability import record_ai_call
        record_ai_call(model, kind, duration_ms, ok, error)
    except Exception:
        pass


def _post_chat(model: str, messages: list[dict], temperature: float, max_tokens: int, kind: str, web_search: bool = False) -> str:
    import httpx
    import time as _time

    base_url = _resolve("LLM_BASE_URL").rstrip("/")
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if web_search:
        # Qwen Cloud's built-in web search plugin (DashScope compatible-mode):
        # the model searches the live Internet server-side before answering.
        # Used by the repair agent when its own fix failed and it must research
        # the exact provider error online.
        payload["enable_search"] = True
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
    web_search: bool = False,
) -> str:
    """Send a chat completion and return the assistant text.

    ``web_search=True`` turns on Qwen Cloud's server-side Internet search for
    this call (used when a repair needs live research on an error).
    Raises RuntimeError if no API key is configured, or on a transport/HTTP error.
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return _post_chat(_resolve("LLM_MODEL"), messages, temperature, max_tokens, kind, web_search=web_search)


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
    image_format: e.g. "png"/"jpeg"; used to build the data: URI.

    Qwen's OpenAI-compatible endpoint takes the standard multimodal message
    shape (a content list with a text part and an image_url data: URI), so this
    is a normal /chat/completions call — no provider-specific path needed.
    """
    model = model or _resolve("LLM_VISION_MODEL")
    fmt = (image_format or "png").lower().lstrip(".")
    if fmt == "jpg":
        fmt = "jpeg"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/{fmt};base64,{image_base64}"},
                },
            ],
        }
    ]
    return _post_chat(model, messages, temperature, max_tokens, kind)


def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm", kind: str = "transcribe") -> str:
    """Transcribe audio to text via Qwen-ASR on Qwen Cloud.

    Uses the OpenAI-compatible audio transcription route on the same DashScope
    endpoint (LLM_AUDIO_BASE_URL defaults to the LLM base URL).
    """
    import httpx
    import time as _time

    base_url = (_cfg("LLM_AUDIO_BASE_URL") or _resolve("LLM_BASE_URL")).rstrip("/")
    model = _cfg("LLM_TRANSCRIBE_MODEL", "qwen3-asr-flash")

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

    base_url = (_cfg("EMBED_BASE_URL") or _resolve("LLM_BASE_URL")).rstrip("/")
    model = _cfg("EMBED_MODEL", "text-embedding-v4")
    key = _cfg("EMBED_API_KEY") or _api_key()

    payload = {"model": model, "input": text[:8000]}
    # text-embedding-v4 is a Qwen3-Embedding (Matryoshka) model that honours a
    # `dimensions` request, so we pin it to the Atlas index width (1024) when
    # EMBED_SEND_DIMENSIONS is on.
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
