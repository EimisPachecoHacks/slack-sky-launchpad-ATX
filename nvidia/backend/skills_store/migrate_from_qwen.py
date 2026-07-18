"""Migrate learned skills from the Qwen backend's store into Supabase pgvector.

Qwen and Nemotron embeddings live in different vector spaces, so vectors are
NEVER copied: each skill's text is re-embedded with the Nemotron embedder
(llama-nemotron-embed-1b-v2 via NIM) on the way in. Safe to re-run (upserts).

Usage (from the repo root):
    project/venv/bin/python nvidia/backend/skills_store/migrate_from_qwen.py

Reads the source from MONGODB_URI in project/.env (falls back to the local JSON
store ~/.skyrchitect/db/skills.json), and the destination + embedder from
nvidia/.env (SUPABASE_URL / SUPABASE_SERVICE_KEY / EMBED_*).
"""

import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_ROOT))


def _load_env(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line.strip())
        if m:
            out[m.group(1)] = m.group(2)  # last occurrence wins, like dotenv
    return out


def _source_skills(qwen_env: dict) -> list[dict]:
    """Skills from the Qwen side: Atlas if reachable, else the local JSON store."""
    uri = qwen_env.get("MONGODB_URI", "")
    if uri:
        try:
            from pymongo import MongoClient
            kwargs = {"serverSelectionTimeoutMS": 5000}
            try:
                import certifi
                kwargs["tlsCAFile"] = certifi.where()
            except Exception:
                pass
            client = MongoClient(uri, **kwargs)
            client.admin.command("ping")
            db = client[qwen_env.get("MONGODB_DB", "sky_launchpad")]
            docs = [{k: v for k, v in d.items() if k != "_id"} for d in db["skills"].find({})]
            print(f"source: MongoDB Atlas ({len(docs)} skills)")
            return docs
        except Exception as exc:
            print(f"source: Atlas unreachable ({exc}); trying local JSON store")
    local = Path.home() / ".skyrchitect" / "db" / "skills.json"
    if local.exists():
        docs = json.loads(local.read_text())
        print(f"source: local JSON store ({len(docs)} skills)")
        return docs
    print("source: no skills found (fresh system)")
    return []


def main() -> None:
    qwen_env = _load_env(REPO_ROOT / "project" / ".env")
    nvidia_env = _load_env(REPO_ROOT / "nvidia" / ".env")

    # Destination + embedder come from the NVIDIA env; make sure the Qwen
    # Mongo URI does NOT leak into the destination process env.
    for k, v in nvidia_env.items():
        os.environ[k] = v
    os.environ["MONGODB_URI"] = ""

    import skydb

    info = skydb.backend_info()
    if info["backend"] != "supabase":
        raise SystemExit(f"destination store is {info['backend']!r}, expected supabase — check nvidia/.env")

    skills = _source_skills(qwen_env)
    migrated = failed = 0
    for doc in skills:
        doc = dict(doc)
        slug = doc.get("slug")
        if not slug:
            continue
        doc.pop("embedding", None)  # NEVER copy vectors across embedding spaces
        try:
            saved = skydb.upsert_skill(doc)  # re-embeds with the Nemotron embedder
            has_vec = bool(saved.get("embedding"))
            print(f"  ✓ {slug}{'' if has_vec else '  (no vector — embedder unreachable, lexical only)'}")
            migrated += 1
        except Exception as exc:
            print(f"  ✗ {slug}: {exc}")
            failed += 1

    total = len(skydb.list_skills())
    print(f"\nmigrated {migrated}, failed {failed}; Supabase now holds {total} skill(s)")


if __name__ == "__main__":
    main()
