"""Learning-dashboard summary builder.

Aggregates the self-improvement loop's data into a single payload for the UI:
KPIs, a before/after-learning comparison, an error -> solution table, and a
timeline of "what it did to learn".

Data sources (read-only, no deployer import):
  - skills/learned/_index.json     (learned skills, written by deployer/skill_library.py)
  - ~/.skyrchitect/deploy_events.json  (deploy timeline, written by deployer/deploy_events.py)

If neither has real data yet, returns a clearly-labeled SAMPLE payload
(`is_sample: true`) so the dashboard is demoable before a live deploy runs.
"""

import json
from pathlib import Path

from backend.skills_loader import _SKILLS_DIR

_INDEX_FILE = _SKILLS_DIR / "learned" / "_index.json"
_EVENTS_FILE = Path.home() / ".skyrchitect" / "deploy_events.json"


# ---------------------------------------------------------------------------
# Sample (clearly labeled) data for the demo
# ---------------------------------------------------------------------------
SAMPLE = {
    "is_sample": True,
    "kpis": {
        "skills_learned": 3,
        "failures_auto_resolved": 3,
        "deploys_preempted": 7,
        "avg_attempts_before": 2.7,
        "avg_attempts_after": 1.0,
    },
    "before_after": {
        "before": {"label": "Before learning", "avg_attempts": 2.7, "success_rate": 0.45, "failures": 5},
        "after": {"label": "After learning", "avg_attempts": 1.0, "success_rate": 1.0, "preempted": 7},
    },
    "errors_solutions": [
        {
            "error_signature": "InvalidInstanceType.ValueNotSupported: the specified instance type is not available in the zone",
            "root_cause": "The chosen ecs.* instance type is not offered in the target zone.",
            "solution": "Query alicloud_instance_types / available zones and pick a supported ecs instance type before creating the instance.",
            "provider": "alicloud",
            "learned_at": "2026-06-25T18:12:00Z",
            "reused_count": 3,
            "slug": "alicloud-supported-instance-type",
        },
        {
            "error_signature": "BucketAlreadyExists (HTTP 409)",
            "root_cause": "OSS bucket names are globally unique; the chosen name was already taken.",
            "solution": "Suffix OSS bucket names with the account id or a short random hash to guarantee uniqueness.",
            "provider": "alicloud",
            "learned_at": "2026-06-25T19:03:00Z",
            "reused_count": 2,
            "slug": "alicloud-unique-oss-bucket-name",
        },
        {
            "error_signature": "InvalidVSwitchId.NotFound: the specified VSwitch does not exist",
            "root_cause": "The VSwitch referenced a VPC that had not been created yet (missing dependency).",
            "solution": "Add an explicit depends_on from the vswitch to the vpc so Terraform orders creation correctly.",
            "provider": "alicloud",
            "learned_at": "2026-06-26T09:41:00Z",
            "reused_count": 2,
            "slug": "alicloud-vswitch-dependency-order",
        },
    ],
    "timeline": [
        {"ts": "2026-06-25T18:11:30Z", "phase": "failure", "text": "terraform apply failed: the specified ECS instance type is not available in the zone", "provider": "alicloud"},
        {"ts": "2026-06-25T18:11:45Z", "phase": "diagnose", "text": "qwen3.7-max repair agent read the Terraform error and identified the unsupported instance type", "provider": "alicloud"},
        {"ts": "2026-06-25T18:12:00Z", "phase": "learned", "text": "Authored reusable skill: alicloud-supported-instance-type", "provider": "alicloud"},
        {"ts": "2026-06-25T18:12:20Z", "phase": "retry", "text": "Re-applied with a zone-supported ecs instance type — deploy succeeded", "provider": "alicloud"},
        {"ts": "2026-06-26T10:02:00Z", "phase": "preempted", "text": "New deploy retrieved alicloud-supported-instance-type and pre-selected a valid type — no failure", "provider": "alicloud"},
    ],
    "observability": {
        "total_calls": 12,
        "success_rate": 1.0,
        "avg_latency_ms": 4200.0,
        "by_model": [
            {"model": "qwen3.7-max (Qwen Cloud)", "calls": 9, "errors": 0, "avg_latency_ms": 2400.0},
            {"model": "text-embedding-v4 (Qwen Cloud)", "calls": 3, "errors": 0, "avg_latency_ms": 40.0},
        ],
    },
}


def _load_index() -> list[dict]:
    # Prefer the queryable store (MongoDB Atlas / local fallback).
    try:
        import skydb
        skills = skydb.list_skills()
        if skills:
            return skills
    except Exception:
        pass
    # Fallback: the on-disk JSON index written alongside SKILL.md files.
    try:
        if _INDEX_FILE.exists():
            data = json.loads(_INDEX_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return list(data.values())
            if isinstance(data, list):
                return data
    except (OSError, ValueError):
        pass
    return []


def _load_events() -> list[dict]:
    try:
        if _EVENTS_FILE.exists():
            data = json.loads(_EVENTS_FILE.read_text(encoding="utf-8"))
            return data if isinstance(data, list) else []
    except (OSError, ValueError):
        pass
    return []


def build_summary() -> dict:
    """Build the learning-dashboard payload from real data, or SAMPLE if empty."""
    from backend.observability import summarize_ai_calls

    skills = _load_index()
    events = _load_events()
    obs = summarize_ai_calls()

    if not skills and not events and not obs.get("total_calls"):
        return SAMPLE

    # --- error -> solution table ---
    errors_solutions = []
    for s in skills:
        errors_solutions.append({
            "error_signature": s.get("error_signature") or s.get("name", ""),
            "root_cause": s.get("root_cause", ""),
            "solution": s.get("fix_pattern") or s.get("description", ""),
            "provider": s.get("provider", ""),
            "learned_at": s.get("created", ""),
            "reused_count": int(s.get("hit_count", 0) or 0),
            "slug": s.get("slug", ""),
        })
    errors_solutions.sort(key=lambda e: e.get("learned_at", ""), reverse=True)

    # --- group events by run to derive before/after attempts ---
    runs: dict[str, list[dict]] = {}
    for e in events:
        runs.setdefault(e.get("run_id") or e.get("ts", ""), []).append(e)

    before_attempts: list[int] = []
    failures_resolved = 0
    for evs in runs.values():
        phases = [x.get("phase") for x in evs]
        n_fail = phases.count("failure")
        if n_fail:
            attempts = n_fail + (1 if "success" in phases else 0)
            before_attempts.append(max(attempts, 1))
            if "success" in phases:
                failures_resolved += 1

    reuse_total = sum(int(s.get("hit_count", 0) or 0) for s in skills)
    avg_before = round(sum(before_attempts) / len(before_attempts), 1) if before_attempts else None

    kpis = {
        "skills_learned": len(skills),
        "failures_auto_resolved": failures_resolved,
        "deploys_preempted": reuse_total,
        "avg_attempts_before": avg_before,
        "avg_attempts_after": 1.0 if reuse_total else None,
    }
    before_after = {
        "before": {"label": "Before learning", "avg_attempts": avg_before, "failures": len(before_attempts)},
        "after": {"label": "After learning", "avg_attempts": 1.0 if reuse_total else None, "preempted": reuse_total},
    }

    timeline = [
        {"ts": e.get("ts", ""), "phase": e.get("phase", ""), "text": e.get("text", ""), "provider": e.get("provider", "")}
        for e in events[-15:][::-1]
    ]

    return {
        "is_sample": False,
        "kpis": kpis,
        "before_after": before_after,
        "errors_solutions": errors_solutions,
        "timeline": timeline,
        "observability": obs,
    }
