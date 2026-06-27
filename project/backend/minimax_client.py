"""MiniMax chat client.

Powers cloud-architecture JSON generation for Sky Launchpad, replacing the
previous Anthropic path. Uses MiniMax's OpenAI-compatible chat completions API
so the request/response shape is standard.

Config (see backend/config.py):
  - MINIMAX_API_KEY   : API key (required to actually call the model)
  - MINIMAX_MODEL     : model id, default "MiniMax-M2" (their best general model)
  - MINIMAX_BASE_URL  : OpenAI-compatible base URL, default https://api.minimax.io/v1
"""

import logging
import os

logger = logging.getLogger(__name__)


def _settings():
    try:
        from backend.config import settings
        return settings
    except Exception:  # allow use outside the FastAPI app (e.g. scripts/tests)
        return None


def minimax_chat(
    prompt: str,
    system: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
) -> str:
    """Send a chat completion to MiniMax and return the assistant text.

    Raises RuntimeError if no API key is configured, or on a transport/HTTP error.
    """
    import httpx

    s = _settings()
    api_key = (getattr(s, "MINIMAX_API_KEY", "") if s else "") or os.getenv("MINIMAX_API_KEY", "")
    base_url = (getattr(s, "MINIMAX_BASE_URL", "") if s else "") or os.getenv(
        "MINIMAX_BASE_URL", "https://api.minimax.io/v1"
    )
    model = (getattr(s, "MINIMAX_MODEL", "") if s else "") or os.getenv("MINIMAX_MODEL", "MiniMax-M2")

    if not api_key:
        raise RuntimeError("MINIMAX_API_KEY is not set — cannot call MiniMax.")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    logger.info(f"[MiniMax] {model}: sending {len(prompt)} chars")
    resp = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers=headers,
        json=payload,
        timeout=120.0,
    )
    resp.raise_for_status()
    data = resp.json()
    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"Unexpected MiniMax response shape: {data}") from exc
    logger.info(f"[MiniMax] received {len(text)} chars")
    return text
