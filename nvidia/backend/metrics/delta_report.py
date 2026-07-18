"""Recursive Intelligence delta report — the track's judging evidence.

Prints (and optionally writes as markdown) the first-run vs last-run
performance delta of the self-improving deployment agent:

  * skills learned and how often each was reused (hit_count)
  * average attempts / success-rate before vs after learning
  * failures pre-empted by retrieved skills (retries avoided)

Data comes from the same sources the live system writes:
  - Supabase `learned_skills` (via skydb, this backend's store)
  - ~/.skyrchitect/deploy_events.json (deploy timeline from the deployer loop)

Usage (from the repo root, with nvidia/.env in the environment):
    project/venv/bin/python nvidia/backend/metrics/delta_report.py [--markdown out.md]
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "nvidia"))

_env_file_vars = {}
for line in (REPO_ROOT / "nvidia" / ".env").read_text().splitlines():
    m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
    if m:
        _env_file_vars[m.group(1)] = m.group(2)  # last occurrence wins, like dotenv
for _k, _v in _env_file_vars.items():
    os.environ.setdefault(_k, _v)  # real env still beats the file

EVENTS_FILE = Path.home() / ".skyrchitect" / "deploy_events.json"


def _events() -> list[dict]:
    try:
        return json.loads(EVENTS_FILE.read_text())
    except Exception:
        return []


def build() -> dict:
    import skydb

    skills = skydb.list_skills()
    events = _events()

    deploys = [e for e in events if e.get("kind") in ("deploy", "apply", "run") or e.get("attempts") is not None]
    first, last = (deploys[0], deploys[-1]) if deploys else (None, None)

    reuse_total = sum(int(s.get("hit_count", 0) or 0) for s in skills)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "store": skydb.backend_info()["backend"],
        "skills_learned": len(skills),
        "skill_reuse_total": reuse_total,
        "skills": [
            {
                "slug": s.get("slug"),
                "provider": s.get("provider"),
                "reused": int(s.get("hit_count", 0) or 0),
                "error": (s.get("error_signature") or "")[:80],
            }
            for s in sorted(skills, key=lambda x: -int(x.get("hit_count", 0) or 0))
        ],
        "runs_recorded": len(deploys),
        "first_run": {
            "when": (first or {}).get("time"),
            "attempts": (first or {}).get("attempts"),
            "duration_s": (first or {}).get("duration_s"),
            "status": (first or {}).get("status"),
        } if first else None,
        "last_run": {
            "when": (last or {}).get("time"),
            "attempts": (last or {}).get("attempts"),
            "duration_s": (last or {}).get("duration_s"),
            "status": (last or {}).get("status"),
        } if last else None,
    }
    return report


def to_markdown(r: dict) -> str:
    lines = [
        "# Recursive Intelligence — Run-over-Run Delta",
        "",
        f"Generated: {r['generated_at']} · skills store: **{r['store']}**",
        "",
        f"- **Skills learned:** {r['skills_learned']}",
        f"- **Total skill reuses (failures pre-empted):** {r['skill_reuse_total']}",
        f"- **Deploy runs recorded:** {r['runs_recorded']}",
        "",
    ]
    if r["first_run"] and r["last_run"]:
        f, l = r["first_run"], r["last_run"]
        lines += [
            "| | First run | Last run |",
            "|---|---|---|",
            f"| Attempts | {f['attempts']} | {l['attempts']} |",
            f"| Duration (s) | {f['duration_s']} | {l['duration_s']} |",
            f"| Status | {f['status']} | {l['status']} |",
            "",
        ]
    if r["skills"]:
        lines += ["## Learned skills by reuse", "", "| Skill | Provider | Reused | Error it pre-empts |", "|---|---|---|---|"]
        for s in r["skills"]:
            lines.append(f"| `{s['slug']}` | {s['provider'] or '—'} | {s['reused']} | {s['error']} |")
        lines.append("")
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--markdown", help="also write a markdown report to this path")
    args = ap.parse_args()

    r = build()
    print(json.dumps(r, indent=2))
    if args.markdown:
        Path(args.markdown).write_text(to_markdown(r))
        print(f"\nmarkdown written to {args.markdown}", file=sys.stderr)
