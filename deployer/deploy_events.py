"""Deploy-event log for the self-improvement loop.

Appends structured events as the deploy/learn loop runs so the learning
dashboard can show a timeline and before/after metrics. Stored as JSON at
~/.skyrchitect/deploy_events.json (runtime data, not committed).

Event shape:
    {
      "ts": ISO8601,
      "run_id": str,
      "provider": "gcp"|"aws",
      "phase": "failure"|"diagnose"|"learned"|"retry"|"success"|"preempted",
      "attempt": int,
      "error_signature": str,
      "skill_slug": str,
      "text": str,
    }
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from .config import SKYRCHITECT_HOME
except Exception:  # usable outside the package
    SKYRCHITECT_HOME = Path.home() / ".skyrchitect"

EVENTS_FILE = SKYRCHITECT_HOME / "deploy_events.json"
_MAX_EVENTS = 500


def _read() -> list[dict]:
    try:
        if EVENTS_FILE.exists():
            data = json.loads(EVENTS_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
    except (OSError, ValueError):
        pass
    return []


def read_events() -> list[dict]:
    """Return all recorded deploy events (oldest first)."""
    return _read()


def record_event(
    phase: str,
    text: str = "",
    *,
    provider: str = "",
    run_id: str = "",
    attempt: int = 0,
    error_signature: str = "",
    skill_slug: str = "",
) -> None:
    """Append one event. Never raises — telemetry must not break the deploy loop."""
    try:
        events = _read()
        events.append({
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": run_id,
            "provider": provider,
            "phase": phase,
            "attempt": int(attempt or 0),
            "error_signature": error_signature,
            "skill_slug": skill_slug,
            "text": text,
        })
        events = events[-_MAX_EVENTS:]
        EVENTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        EVENTS_FILE.write_text(json.dumps(events, indent=2), encoding="utf-8")
    except Exception as exc:  # pragma: no cover - telemetry best-effort
        logger.debug(f"deploy_events record failed: {exc}")
