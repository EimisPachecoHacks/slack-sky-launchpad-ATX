"""Apps dashboard backend for **Sky Launchpad**.

Exposes an :class:`fastapi.APIRouter` (``router``) under ``/api/apps`` that the
orchestrator (``backend/api/main.py``) mounts. Powers the "Apps" dashboard:
listing tracked apps with a derived status, generating end-to-end UI test
workflows via Gemma 3, and drilling into a single app's cases + run history.

Design notes
------------
* Every handler imports ``skydb`` / ``llm_client`` **lazily** so a missing
  dependency degrades to a graceful response instead of crashing import-time.
* Nothing on a normal path raises an unhandled 500: failures fall back to safe
  defaults (sample payload, generic test cases, empty lists).
* When no apps are tracked yet, ``GET /api/apps`` returns a clearly-labelled
  SAMPLE payload (``is_sample: true``) so the UI has something to render.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/apps", tags=["apps"])


# ---------------------------------------------------------------------------
# Lazy dependency access
# ---------------------------------------------------------------------------
def _skydb():
    """Import the shared data layer lazily; return module or ``None``."""
    try:
        import skydb  # repo root is on sys.path (added by main.py)

        return skydb
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("skydb unavailable: %s", exc)
        return None


def _llm_chat():
    """Return the ``llm_client.chat`` callable lazily, or ``None`` if unavailable."""
    try:
        from backend.llm_client import chat

        return chat
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("llm_client unavailable: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _derive_status(has_cases: bool, has_runs: bool, latest: Optional[dict]) -> str:
    """Map app state -> dashboard status string.

    no cases AND no runs           -> "untested"
    latest run passed              -> "passing"
    latest run failed              -> "failing"
    inconclusive / has cases only  -> "inconclusive"
    """
    if not has_cases and not has_runs:
        return "untested"
    if latest:
        run_status = (latest.get("status") or "").lower()
        if run_status == "passed":
            return "passing"
        if run_status == "failed":
            return "failing"
    return "inconclusive"


def _latest_run_view(latest: Optional[dict]) -> Optional[dict]:
    """Trim a run doc to the compact shape the card carries, or ``None``."""
    if not latest:
        return None
    return {
        "status": latest.get("status"),
        "summary": latest.get("summary"),
        "error": latest.get("error"),
        "solution": latest.get("solution"),
        "mr_url": latest.get("mr_url"),
    }


def _app_card(skydb, app: dict) -> dict:
    """Build an AppCard for a real (tracked) app."""
    app_id = app.get("app_id")
    try:
        cases = skydb.list_test_cases(app_id) if app_id else []
    except Exception:
        cases = []
    try:
        latest = skydb.latest_test_run(app_id) if app_id else None
    except Exception:
        latest = None
    try:
        runs = skydb.list_test_runs(app_id) if app_id else []
    except Exception:
        runs = []

    has_cases = bool(cases)
    has_runs = bool(runs)
    status = _derive_status(has_cases, has_runs, latest)

    return {
        "app_id": app_id,
        "name": app.get("name"),
        "provider": app.get("provider"),
        "environment": app.get("environment"),
        "url": app.get("url"),
        "alive": app.get("alive"),
        "health_status": app.get("health_status"),
        "status": status,
        "test_case_count": len(cases),
        "last_tested": latest.get("finished") if latest else None,
        "latest_run": _latest_run_view(latest),
    }


def _sample_payload() -> dict:
    """A clearly-labelled demo payload used when no apps are tracked yet."""
    apps = [
        {
            "app_id": "sample-passing",
            "name": "Checkout Service (demo)",
            "provider": "gcp",
            "environment": "production",
            "url": "https://checkout-demo.example.app",
            "alive": True,
            "health_status": "200 OK",
            "status": "passing",
            "test_case_count": 4,
            "last_tested": "2026-06-27T12:00:00+00:00",
            "latest_run": {
                "status": "passed",
                "summary": "All 4 end-to-end workflows passed.",
                "error": None,
                "solution": None,
                "mr_url": None,
            },
        },
        {
            "app_id": "sample-failing",
            "name": "Deploy Portal (demo)",
            "provider": "gcp",
            "environment": "staging",
            "url": "https://deploy-portal-demo.example.app",
            "alive": True,
            "health_status": "502 Bad Gateway",
            "status": "failing",
            "test_case_count": 3,
            "last_tested": "2026-06-27T11:30:00+00:00",
            "latest_run": {
                "status": "failed",
                "summary": "Deploy workflow failed at the readiness check.",
                "error": "Cloud Run service returned 502 on /api/deploy",
                "solution": "Increased container memory to 512Mi and added a readiness probe",
                "mr_url": "https://gitlab.com/sky-launchpad/deploy-portal/-/merge_requests/12",
            },
        },
        {
            "app_id": "sample-untested",
            "name": "Marketing Site (demo)",
            "provider": "vercel",
            "environment": "production",
            "url": "https://marketing-demo.example.app",
            "alive": None,
            "health_status": None,
            "status": "untested",
            "test_case_count": 0,
            "last_tested": None,
            "latest_run": None,
        },
    ]
    return {"is_sample": True, "apps": apps}


def _extract_json_array(text: str) -> Optional[list]:
    """Best-effort extraction of a JSON array from an LLM response.

    Handles ```json fences, leading/trailing prose, and bare arrays.
    """
    if not text:
        return None

    # 1) Try fenced code block first (```json ... ``` or ``` ... ```).
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    candidates = []
    if fence:
        candidates.append(fence.group(1).strip())
    candidates.append(text.strip())

    # 2) Also try slicing from the first '[' to the last ']'.
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        candidates.append(text[start : end + 1])

    for cand in candidates:
        try:
            parsed = json.loads(cand)
        except Exception:
            continue
        if isinstance(parsed, list):
            return parsed
        # Some models wrap the array in an object like {"cases": [...]}.
        if isinstance(parsed, dict):
            for v in parsed.values():
                if isinstance(v, list):
                    return v
    return None


def _generic_cases() -> list[dict]:
    """Fallback test cases used when the LLM is unavailable or unparseable."""
    return [
        {
            "name": "App loads",
            "prompt": (
                "Open the app's URL in a browser and confirm the main page renders "
                "without errors, the title is visible, and there are no obvious "
                "broken images or blank/white screens."
            ),
        },
        {
            "name": "Primary navigation works",
            "prompt": (
                "From the landing page, click each primary navigation link or menu "
                "item and confirm each destination loads its expected content "
                "without 404s or console errors."
            ),
        },
    ]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("/health")
async def apps_health() -> dict:
    """Lightweight readiness probe reporting the skydb backend in use."""
    skydb = _skydb()
    if not skydb:
        return {"db": {"backend": "unavailable", "error": "skydb import failed"}}
    try:
        return {"db": skydb.backend_info()}
    except Exception as exc:  # pragma: no cover - defensive
        return {"db": {"backend": "error", "error": str(exc)}}


@router.get("")
async def list_apps_dashboard() -> dict:
    """List tracked apps as AppCards, or a SAMPLE payload when none exist."""
    skydb = _skydb()
    if not skydb:
        return _sample_payload()
    try:
        apps = skydb.list_apps() or []
    except Exception as exc:
        logger.warning("list_apps failed: %s", exc)
        return _sample_payload()

    if not apps:
        return _sample_payload()

    cards = []
    for app in apps:
        try:
            cards.append(_app_card(skydb, app))
        except Exception as exc:  # one bad doc shouldn't sink the list
            logger.warning("failed to build card for app %r: %s", app, exc)
    return {"is_sample": False, "apps": cards}


@router.post("/{app_id}/generate-tests")
async def generate_tests(app_id: str) -> dict:
    """Propose 4 end-to-end UI test workflows for an app via Gemma 3.

    Falls back to 2 generic cases on any LLM/parse failure. Ensures the app is
    tracked in skydb (e.g. when it originated as a sample) before storing cases.
    """
    skydb = _skydb()

    # Resolve the app record (may be a sample that isn't tracked yet).
    app: Optional[dict] = None
    if skydb:
        try:
            app = skydb.get_app(app_id)
        except Exception:
            app = None

    name = (app or {}).get("name") or app_id
    url = (app or {}).get("url") or ""
    provider = (app or {}).get("provider") or "unknown"

    # Ensure the app is tracked so cases attach to a real record.
    if skydb:
        try:
            if not app:
                tracked = skydb.upsert_app(
                    {
                        "app_id": app_id,
                        "name": name,
                        "provider": provider,
                        "environment": (app or {}).get("environment") or "production",
                        "url": url,
                        "source": "generate-tests",
                    }
                )
                # upsert_app may mint a new id if app_id was absent; honour it.
                app_id = tracked.get("app_id", app_id)
        except Exception as exc:
            logger.warning("upsert_app failed for %s: %s", app_id, exc)

    # Ask Gemma 3 for concise workflows.
    proposed: Optional[list] = None
    chat = _llm_chat()
    if chat:
        system = (
            "You are a senior QA engineer. You design concise, end-to-end UI "
            "test workflows that a vision-based browser agent can execute by "
            "looking at the screen and clicking/typing. Return ONLY valid JSON."
        )
        prompt = (
            f"App name: {name}\n"
            f"URL: {url or '(unknown)'}\n"
            f"Provider: {provider}\n\n"
            "Propose exactly 4 concise end-to-end UI test workflows that exercise "
            "the app's most important user journeys. Each workflow must be a "
            "plain-English description a vision agent can follow step by step "
            "(navigate, click, type, verify), with a clear success condition.\n\n"
            'Return ONLY a JSON array of objects shaped {"name": "...", "prompt": "..."}. '
            "No prose, no markdown, no code fences."
        )
        try:
            raw = chat(prompt, system=system, temperature=0.3, max_tokens=1500, kind="qa-workflow")
            parsed = _extract_json_array(raw)
            if parsed:
                cleaned = []
                for item in parsed:
                    if not isinstance(item, dict):
                        continue
                    nm = str(item.get("name") or "").strip()
                    pr = str(item.get("prompt") or "").strip()
                    if nm and pr:
                        cleaned.append({"name": nm, "prompt": pr})
                if cleaned:
                    proposed = cleaned[:4]
        except Exception as exc:
            logger.warning("Gemma 3 test generation failed for %s: %s", app_id, exc)

    if not proposed:
        proposed = _generic_cases()

    # Persist each case.
    stored: list[dict] = []
    for case in proposed:
        rec = {"app_id": app_id, "name": case["name"], "prompt": case["prompt"]}
        if skydb:
            try:
                saved = skydb.add_test_case(rec)
                stored.append(
                    {
                        "case_id": saved.get("case_id"),
                        "name": saved.get("name"),
                        "prompt": saved.get("prompt"),
                    }
                )
                continue
            except Exception as exc:
                logger.warning("add_test_case failed for %s: %s", app_id, exc)
        # skydb unavailable / store failed: still return the proposed case.
        stored.append({"case_id": None, "name": rec["name"], "prompt": rec["prompt"]})

    return {"cases": stored}


@router.get("/{app_id}")
async def get_app_detail(app_id: str) -> dict:
    """Return an app with its test cases and run history (newest first)."""
    skydb = _skydb()
    if not skydb:
        return {"app": None, "test_cases": [], "test_runs": []}

    try:
        app = skydb.get_app(app_id)
    except Exception as exc:
        logger.warning("get_app failed for %s: %s", app_id, exc)
        app = None

    try:
        cases = skydb.list_test_cases(app_id) or []
    except Exception:
        cases = []

    try:
        runs = skydb.list_test_runs(app_id) or []
        runs.sort(key=lambda r: r.get("finished", ""), reverse=True)
    except Exception:
        runs = []

    return {"app": app, "test_cases": cases, "test_runs": runs}
