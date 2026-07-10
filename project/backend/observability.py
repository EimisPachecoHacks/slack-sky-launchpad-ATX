"""Observability for Sky Launchpad — Pydantic Logfire.

Provides the Self-Improvement-Stack observability layer:
  - configure_observability(app): set up Logfire and auto-instrument FastAPI +
    httpx, so every request and every outbound Gemma 3 / Whisper call is traced.
  - record_ai_call(...): emit a Logfire span AND append to a local metrics file
    (~/.skyrchitect/ai_calls.json) so our own learning dashboard can show real
    telemetry (call counts, latency, success rate) instead of sample data.

All Logfire usage is guarded: if the package or a token is absent, the app still
runs (Logfire only ships to the cloud UI when LOGFIRE_TOKEN is present).
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

_HOME = Path.home() / ".skyrchitect"
AI_CALLS_FILE = _HOME / "ai_calls.json"
_MAX_CALLS = 1000

_configured = False


def configure_observability(app=None) -> bool:
    """Configure Logfire and instrument FastAPI + httpx. Safe no-op on failure."""
    global _configured
    if _configured:
        return True
    try:
        import logfire

        # send_to_logfire='if-token-present' => ships to the Logfire UI only when
        # LOGFIRE_TOKEN is set; otherwise it instruments locally without erroring.
        logfire.configure(
            service_name="sky-launchpad",
            send_to_logfire="if-token-present",
            console=False,
        )
        try:
            logfire.instrument_httpx()  # auto-trace all OpenAI-compatible HTTP calls
        except Exception as exc:
            logger.debug(f"instrument_httpx skipped: {exc}")
        if app is not None:
            try:
                logfire.instrument_fastapi(app)
            except Exception as exc:
                logger.debug(f"instrument_fastapi skipped: {exc}")
        _configured = True
        logger.info("📈 Logfire observability configured")
        return True
    except Exception as exc:
        logger.warning(f"Logfire not configured (continuing without it): {exc}")
        return False


def _logfire_event(model: str, kind: str, duration_ms: float, ok: bool, error: str) -> None:
    try:
        import logfire

        logfire.info(
            "ai_call",
            model=model,
            kind=kind,
            duration_ms=round(duration_ms, 1),
            ok=ok,
            error=error or None,
        )
    except Exception:
        pass


def _read_calls() -> list[dict]:
    try:
        if AI_CALLS_FILE.exists():
            data = json.loads(AI_CALLS_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
    except (OSError, ValueError):
        pass
    return []


def record_ai_call(model: str, kind: str, duration_ms: float, ok: bool, error: str = "") -> None:
    """Record one AI provider call to Logfire and the local metrics file. Never raises."""
    _logfire_event(model, kind, duration_ms, ok, error)
    try:
        calls = _read_calls()
        calls.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "model": model,
            "kind": kind,          # e.g. "architecture", "vision", "transcribe"
            "duration_ms": round(duration_ms, 1),
            "ok": bool(ok),
            "error": error or "",
        })
        calls = calls[-_MAX_CALLS:]
        AI_CALLS_FILE.parent.mkdir(parents=True, exist_ok=True)
        AI_CALLS_FILE.write_text(json.dumps(calls, indent=2), encoding="utf-8")
    except Exception as exc:  # pragma: no cover - telemetry best-effort
        logger.debug(f"record_ai_call failed: {exc}")


def summarize_ai_calls() -> dict:
    """Aggregate local AI-call metrics for the learning dashboard."""
    calls = _read_calls()
    if not calls:
        return {"total_calls": 0, "success_rate": None, "avg_latency_ms": None, "by_model": []}
    total = len(calls)
    oks = sum(1 for c in calls if c.get("ok"))
    latencies = [c.get("duration_ms", 0) for c in calls if c.get("duration_ms")]
    by_model: dict[str, dict] = {}
    for c in calls:
        m = c.get("model", "unknown")
        b = by_model.setdefault(m, {"model": m, "calls": 0, "errors": 0, "lat": []})
        b["calls"] += 1
        if not c.get("ok"):
            b["errors"] += 1
        if c.get("duration_ms"):
            b["lat"].append(c["duration_ms"])
    models = [
        {
            "model": b["model"],
            "calls": b["calls"],
            "errors": b["errors"],
            "avg_latency_ms": round(sum(b["lat"]) / len(b["lat"]), 1) if b["lat"] else None,
        }
        for b in by_model.values()
    ]
    models.sort(key=lambda m: m["calls"], reverse=True)
    return {
        "total_calls": total,
        "success_rate": round(oks / total, 3),
        "avg_latency_ms": round(sum(latencies) / len(latencies), 1) if latencies else None,
        "by_model": models,
    }
