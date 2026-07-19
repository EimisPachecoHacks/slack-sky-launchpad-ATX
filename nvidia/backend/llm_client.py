"""OpenAI-compatible client for NVIDIA Nemotron models — NVIDIA backend variant.

This is the PROTECTED divergence file of the NVIDIA/Slack backend (see
scripts/sync-backends.sh and docs/NVIDIA_BACKEND_PLAN.md). Same public API as
the canonical Qwen client, different providers underneath:

  chat(...)        : text generation / reasoning -> Nemotron 3 Nano 30B-A3B on
                     SELF-HOSTED vLLM (the box `sky-nvidia`) — the vLLM-bounty path
  vision_chat(...) : diagram analysis            -> Nemotron Nano VL 8B via NVIDIA
                     NIM API (integrate.api.nvidia.com)
  transcribe(...)  : NOT supported on this backend (Qwen-ASR only; the Slack UI
                     never uses voice) — raises RuntimeError
  embed(...)       : skill-retrieval vectors     -> llama-nemotron-embed-1b-v2
                     (1024-d Matryoshka) on the local vLLM embed server

Reasoning models may emit <think>...</think> traces in content when the server
runs without a reasoning parser; chat() strips them so callers always get the
final answer text.

Config (see backend/config.py):
  LLM_BASE_URL (vLLM), LLM_MODEL, LLM_VISION_BASE_URL (NIM), LLM_VISION_MODEL,
  NVIDIA_API_KEY, EMBED_BASE_URL, EMBED_MODEL, EMBED_DIMENSIONS, EMBED_SEND_DIMENSIONS
"""

import logging
import os
import re

logger = logging.getLogger(__name__)

# Self-hosted vLLM endpoint (brev port-forward from sky-nvidia by default).
VLLM_BASE_URL = "http://localhost:8001/v1"
# NVIDIA NIM cloud endpoint — used ONLY for the vision side-path.
NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"

_DEFAULTS = {
    "LLM_BASE_URL": VLLM_BASE_URL,
    "LLM_MODEL": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",  # MoE: 3.5B active
    "LLM_VISION_BASE_URL": NIM_BASE_URL,
    "LLM_VISION_MODEL": "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
    "EMBED_BASE_URL": NIM_BASE_URL,  # GPU is fully allocated to the 30B text model
}

_TIMEOUT = 180.0  # self-hosted 30B on A100 is slower per-token than a hosted API

_THINK_RE = re.compile(r"<think>.*?</think>\s*", re.DOTALL)
# vLLM without a reasoning parser can emit the trace with only a closing tag
# (the opening tag is consumed by the chat template) — strip that form too.
_THINK_OPEN_RE = re.compile(r"^.*?</think>\s*", re.DOTALL)


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
    """Explicit setting wins; otherwise the Nemotron/vLLM default."""
    return _cfg(name) or _DEFAULTS.get(name, "")


def _api_key() -> str:
    # The self-hosted vLLM server is unauthenticated by default; "EMPTY" is the
    # conventional placeholder bearer token for local OpenAI-compatible servers.
    return _cfg("LLM_API_KEY") or "EMPTY"


def _nim_key() -> str:
    return _cfg("NVIDIA_API_KEY") or _cfg("LLM_API_KEY") or "EMPTY"


def _provider() -> str:
    """The inference backend. Nemotron on self-hosted vLLM (+ NIM for vision)."""
    return "nemotron"


def _strip_reasoning(text: str) -> str:
    """Remove <think>...</think> traces a reasoning model may emit in content."""
    text = _THINK_RE.sub("", text)
    if "</think>" in text:
        text = _THINK_OPEN_RE.sub("", text)
    return text.strip()


def _record(model: str, kind: str, duration_ms: float, ok: bool, error: str) -> None:
    try:
        from backend.observability import record_ai_call
        record_ai_call(model, kind, duration_ms, ok, error)
    except Exception:
        pass


def _post_chat(
    model: str,
    messages: list[dict],
    temperature: float,
    max_tokens: int,
    kind: str,
    base_url: str | None = None,
    api_key: str | None = None,
) -> str:
    import httpx
    import time as _time

    base_url = (base_url or _resolve("LLM_BASE_URL")).rstrip("/")
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key or _api_key()}",
        "Content-Type": "application/json",
    }

    logger.info(f"[{_provider()}] {model}: {kind}")
    _t0 = _time.monotonic()
    try:
        resp = httpx.post(f"{base_url}/chat/completions", headers=headers, json=payload, timeout=_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        try:
            msg = data["choices"][0]["message"]
            text = msg.get("content") or ""
            # Some reasoning parsers put the answer in content and the trace in
            # reasoning_content; without a parser the trace lands inline. Cover both.
            text = _strip_reasoning(text)
            if not text and msg.get("reasoning_content"):
                text = _strip_reasoning(msg["reasoning_content"])
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
    """Send a chat completion to the self-hosted vLLM Nemotron and return the text.

    Nemotron is a REASONING model: it spends thousands of tokens thinking before
    the answer. Callers' max_tokens assume answer-only budgets, so we raise the
    floor — otherwise generation truncates mid-reasoning and the caller sees
    "response did not contain valid JSON".

    Raises RuntimeError on a transport/HTTP error (e.g. the vLLM box is down or
    the port-forward is not running).
    """
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return _post_chat(_resolve("LLM_MODEL"), messages, temperature, max(max_tokens, 12288), kind)


def vision_chat(
    image_base64: str,
    image_format: str,
    prompt: str,
    model: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    kind: str = "vision",
) -> str:
    """Analyze an image with Nemotron Nano VL via the NVIDIA NIM API.

    image_base64: base64-encoded image bytes (no data: prefix).
    image_format: e.g. "png"/"jpeg"; used to build the data: URI.

    The NIM endpoint takes the standard OpenAI multimodal message shape, so this
    is a normal /chat/completions call against a different base URL + key.
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
    return _post_chat(
        model,
        messages,
        temperature,
        max_tokens,
        kind,
        base_url=_resolve("LLM_VISION_BASE_URL"),
        api_key=_nim_key(),
    )


def transcribe(audio_bytes: bytes, mime_type: str = "audio/webm", kind: str = "transcribe") -> str:
    """Speech-to-text is not available on the NVIDIA backend (no Nemotron ASR).

    The Slack UI never records audio, so this only fires if a web client is
    pointed at this backend by mistake.
    """
    raise RuntimeError(
        "Voice transcription is not supported on the NVIDIA backend — "
        "use the Qwen backend (project/) for the web app's voice input."
    )


def embed(text: str) -> list[float] | None:
    """Embed a string for skill retrieval. Returns None on any failure.

    Uses llama-nemotron-embed-1b-v2 on the local vLLM embed server. The model is
    Matryoshka-trained: if the server ignores/rejects the `dimensions` request
    parameter, we truncate to EMBED_DIMENSIONS and re-normalize client-side,
    which is the documented Matryoshka reduction.

    Callers treat None as "vector search unavailable" and fall back to lexical
    matching, so this never raises.
    """
    if not text:
        return None

    base_url = _resolve("EMBED_BASE_URL").rstrip("/")
    model = _cfg("EMBED_MODEL", "nvidia/llama-nemotron-embed-1b-v2")
    key = _cfg("EMBED_API_KEY") or _api_key()
    dims = int(_cfg("EMBED_DIMENSIONS", "1024"))

    payload = {"model": model, "input": text[:8000]}
    if str(_cfg("EMBED_SEND_DIMENSIONS", "")).lower() in ("1", "true", "yes"):
        payload["dimensions"] = dims
    # Asymmetric retrieval model (NIM) requires input_type; callers here embed queries.
    if str(_cfg("EMBED_SEND_INPUT_TYPE", "")).lower() in ("1", "true", "yes"):
        payload["input_type"] = "query"

    import httpx

    def _post(p):
        resp = httpx.post(
            f"{base_url}/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=p,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]

    try:
        try:
            vec = _post(payload)
        except Exception:
            if "dimensions" not in payload:
                raise
            payload.pop("dimensions")  # server rejected the param — reduce client-side
            vec = _post(payload)
        if len(vec) > dims:
            vec = vec[:dims]
            norm = sum(v * v for v in vec) ** 0.5 or 1.0
            vec = [v / norm for v in vec]
        return vec
    except Exception as exc:
        logger.warning("embed() failed (%s); retrieval will fall back to lexical", exc)
        return None
