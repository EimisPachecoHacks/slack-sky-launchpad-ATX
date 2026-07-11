"""Sky Launchpad data layer.

Single source of truth for the dashboards: learned **skills**, deployed **apps**,
**test_runs**, and **test_cases**. Backed by **MongoDB Atlas** when ``MONGODB_URI``
is set; otherwise a local JSON fallback (~/.skyrchitect/db/) so dev/tests run with
no cluster. Same API either way — flip backends by setting the env var.

Importable by both `backend.*` (the FastAPI app) and `deployer.*` (the CLI/loop)
since it lives at the repo root.

Collections: skills, apps, test_runs, test_cases.
"""

import json
import logging
import math
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_LOCAL_DIR = Path.home() / ".skyrchitect" / "db"
_DB_NAME = os.getenv("MONGODB_DB", "sky_launchpad")
_VECTOR_INDEX = os.getenv("MONGODB_VECTOR_INDEX", "")  # set to enable Atlas $vectorSearch


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


# ---------------------------------------------------------------------------
# Backend abstraction
# ---------------------------------------------------------------------------
class _MongoStore:
    def __init__(self, client, db_name: str):
        self._db = client[db_name]
        self.kind = "mongodb"

    def upsert(self, coll, key_field, doc):
        self._db[coll].update_one({key_field: doc[key_field]}, {"$set": doc}, upsert=True)
        return doc

    def insert(self, coll, doc):
        self._db[coll].insert_one(dict(doc))
        return doc

    def all(self, coll, filt=None):
        return [self._strip(d) for d in self._db[coll].find(filt or {})]

    def find(self, coll, filt):
        d = self._db[coll].find_one(filt)
        return self._strip(d) if d else None

    def update(self, coll, filt, changes):
        self._db[coll].update_one(filt, {"$set": changes})

    def inc(self, coll, filt, field, amount=1):
        self._db[coll].update_one(filt, {"$inc": {field: amount}})

    def delete(self, coll, filt):
        return self._db[coll].delete_many(filt).deleted_count

    @staticmethod
    def _strip(d):
        if d and "_id" in d:
            d = dict(d)
            d.pop("_id", None)
        return d


class _LocalStore:
    """JSON-file fallback. One file per collection; small-scale, dev only."""

    def __init__(self, base: Path):
        self.base = base
        self.base.mkdir(parents=True, exist_ok=True)
        self.kind = "local"

    def _path(self, coll):
        return self.base / f"{coll}.json"

    def _load(self, coll):
        p = self._path(coll)
        try:
            return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []
        except (OSError, ValueError):
            return []

    def _save(self, coll, rows):
        self._path(coll).write_text(json.dumps(rows, indent=2), encoding="utf-8")

    def upsert(self, coll, key_field, doc):
        rows = self._load(coll)
        for i, r in enumerate(rows):
            if r.get(key_field) == doc.get(key_field):
                rows[i] = {**r, **doc}
                self._save(coll, rows)
                return rows[i]
        rows.append(doc)
        self._save(coll, rows)
        return doc

    def insert(self, coll, doc):
        rows = self._load(coll)
        rows.append(doc)
        self._save(coll, rows)
        return doc

    def all(self, coll, filt=None):
        rows = self._load(coll)
        if filt:
            rows = [r for r in rows if all(r.get(k) == v for k, v in filt.items())]
        return rows

    def find(self, coll, filt):
        for r in self._load(coll):
            if all(r.get(k) == v for k, v in filt.items()):
                return r
        return None

    def update(self, coll, filt, changes):
        rows = self._load(coll)
        for i, r in enumerate(rows):
            if all(r.get(k) == v for k, v in filt.items()):
                rows[i] = {**r, **changes}
        self._save(coll, rows)

    def inc(self, coll, filt, field, amount=1):
        rows = self._load(coll)
        for i, r in enumerate(rows):
            if all(r.get(k) == v for k, v in filt.items()):
                rows[i][field] = int(r.get(field, 0)) + amount
        self._save(coll, rows)

    def delete(self, coll, filt):
        rows = self._load(coll)
        kept = [r for r in rows if not all(r.get(k) == v for k, v in filt.items())]
        self._save(coll, kept)
        return len(rows) - len(kept)


_store = None
_store_err = ""


def _get_store():
    global _store, _store_err
    if _store is not None:
        return _store
    uri = os.getenv("MONGODB_URI", "")
    if uri:
        try:
            from pymongo import MongoClient

            # macOS / python.org builds often lack system CA access -> point TLS at
            # certifi's bundle so Atlas's cert verifies (fixes CERTIFICATE_VERIFY_FAILED).
            kwargs = {"serverSelectionTimeoutMS": 4000}
            try:
                import certifi
                kwargs["tlsCAFile"] = certifi.where()
            except Exception:
                pass
            client = MongoClient(uri, **kwargs)
            client.admin.command("ping")
            _store = _MongoStore(client, _DB_NAME)
            logger.info("🍃 skydb using MongoDB Atlas (db=%s)", _DB_NAME)
            return _store
        except Exception as exc:  # fall back to local on any connection problem
            _store_err = str(exc)
            logger.warning("MongoDB unavailable (%s); using local JSON store", exc)
    _store = _LocalStore(_LOCAL_DIR)
    return _store


def backend_info() -> dict:
    s = _get_store()
    return {"backend": s.kind, "uri_set": bool(os.getenv("MONGODB_URI")), "db": _DB_NAME, "error": _store_err}


# ---------------------------------------------------------------------------
# Skills
# ---------------------------------------------------------------------------
_EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-v4")
_EMBED_BASE_URL = os.getenv("EMBED_BASE_URL") or os.getenv("LLM_BASE_URL") \
    or "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
# Expected output width. Must match the Atlas index's numDimensions. This is an
# assertion about the model, NOT a request parameter — see _SEND_DIMENSIONS.
_EMBED_DIMENSIONS = int(os.getenv("EMBED_DIMENSIONS", "1024"))
# text-embedding-v4 (Qwen3-Embedding, Matryoshka) honours a `dimensions` request,
# so pin it to the Atlas index width (1024). On by default for the Qwen embedder.
_SEND_DIMENSIONS = os.getenv("EMBED_SEND_DIMENSIONS", "true").lower() in ("1", "true", "yes")


def _embed_text(text: str):
    """Canonical skill embedding via Qwen Cloud (text-embedding-v4). None on any failure.

    This is the ONLY embedder in the system. Vectors from different models are
    not comparable, so there is deliberately no cross-provider fallback: when
    the endpoint is unreachable we return None and `find_similar_skills` drops
    to lexical cosine rather than poisoning the index with a foreign vector
    space.
    """
    if not text:
        return None
    key = os.getenv("EMBED_API_KEY") or os.getenv("DASHSCOPE_API_KEY") or os.getenv("LLM_API_KEY") or "EMPTY"
    payload = {"model": _EMBED_MODEL, "input": text[:8000]}
    if _SEND_DIMENSIONS:
        payload["dimensions"] = _EMBED_DIMENSIONS
    try:
        import httpx
        r = httpx.post(
            f"{_EMBED_BASE_URL.rstrip('/')}/embeddings",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30.0,
        )
        r.raise_for_status()
        vec = r.json()["data"][0]["embedding"]
    except Exception as exc:
        logger.warning("embedding unavailable (%s); retrieval falls back to lexical", exc)
        return None

    # A width change means the Atlas index no longer matches: refuse the vector
    # rather than write a doc $vectorSearch will silently never return.
    if len(vec) != _EMBED_DIMENSIONS:
        logger.error(
            "embedder returned %d dims but EMBED_DIMENSIONS=%d — refusing to store. "
            "Fix EMBED_DIMENSIONS and recreate the Atlas index.", len(vec), _EMBED_DIMENSIONS
        )
        return None
    return vec


def _skill_blob(doc: dict) -> str:
    return " ".join(filter(None, [
        doc.get("error_signature", ""), doc.get("description", ""), doc.get("fix_pattern", ""),
    ]))


def upsert_skill(doc: dict) -> dict:
    """doc keys: slug (required), name, description, error_signature, root_cause,
    fix_pattern, provider, markdown_path, embedding (optional list), created, hit_count."""
    doc = dict(doc)
    doc.setdefault("created", _now())
    doc.setdefault("hit_count", 0)
    if not doc.get("embedding"):
        emb = _embed_text(_skill_blob(doc))
        if emb:
            doc["embedding"] = emb
    return _get_store().upsert("skills", "slug", doc)


def backfill_skill_embeddings(force: bool = False) -> int:
    """Compute + store embeddings for skills missing one. Returns count updated.

    Pass force=True after changing EMBED_MODEL/EMBED_DIMENSIONS: existing vectors
    belong to the old model's space and must all be recomputed, not just the
    missing ones.
    """
    n = 0
    for s in list_skills():
        if force or not s.get("embedding"):
            emb = _embed_text(_skill_blob(s))
            if emb:
                _get_store().update("skills", {"slug": s["slug"]}, {"embedding": emb})
                n += 1
    return n


def list_skills() -> list[dict]:
    return _get_store().all("skills")


def incr_skill_hit(slug: str) -> None:
    _get_store().inc("skills", {"slug": slug}, "hit_count", 1)


def _tokens(text: str):
    return [t for t in re.split(r"[^a-z0-9.]+", (text or "").lower()) if t]


def _cosine_tf(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    from collections import Counter

    ca, cb = Counter(ta), Counter(tb)
    common = set(ca) & set(cb)
    dot = sum(ca[t] * cb[t] for t in common)
    na = math.sqrt(sum(v * v for v in ca.values()))
    nb = math.sqrt(sum(v * v for v in cb.values()))
    return dot / (na * nb) if na and nb else 0.0


def _cosine_vec(a, b) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def find_similar_skills(query: str, k: int = 3, query_embedding: Optional[list] = None) -> list[dict]:
    """Return up to k skills most similar to `query`.

    Uses Atlas $vectorSearch when MONGODB_VECTOR_INDEX is set and an embedding is
    given; otherwise embedding cosine over stored vectors; otherwise lexical cosine.
    """
    store = _get_store()
    # Atlas Vector Search path
    if store.kind == "mongodb" and _VECTOR_INDEX:
        if query_embedding is None:
            query_embedding = _embed_text(query)
        if query_embedding:
            try:
                pipeline = [
                    {"$vectorSearch": {
                        "index": _VECTOR_INDEX,
                        "path": "embedding",
                        "queryVector": query_embedding,
                        "numCandidates": 100,
                        "limit": k,
                    }},
                    {"$project": {"_id": 0, "score": {"$meta": "vectorSearchScore"}, "doc": "$$ROOT"}},
                ]
                out = []
                for row in store._db["skills"].aggregate(pipeline):
                    d = _MongoStore._strip(row.get("doc", {}))
                    d["score"] = row.get("score")
                    out.append(d)
                if out:
                    return out
            except Exception as exc:
                logger.debug("vectorSearch failed, falling back: %s", exc)

    skills = list_skills()
    scored = []
    for s in skills:
        if query_embedding and s.get("embedding"):
            score = _cosine_vec(query_embedding, s["embedding"])
        else:
            blob = " ".join([s.get("error_signature", ""), s.get("description", ""), s.get("fix_pattern", "")])
            score = _cosine_tf(query, blob)
        scored.append({**s, "score": round(score, 4)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]


# ---------------------------------------------------------------------------
# Apps
# ---------------------------------------------------------------------------
def upsert_app(doc: dict) -> dict:
    """doc keys: app_id (required), name, provider, url, source, environment, created, last_seen."""
    doc = dict(doc)
    doc.setdefault("app_id", _new_id())
    doc.setdefault("created", _now())
    doc["last_seen"] = _now()
    return _get_store().upsert("apps", "app_id", doc)


def list_apps() -> list[dict]:
    return _get_store().all("apps")


def get_app(app_id: str) -> Optional[dict]:
    return _get_store().find("apps", {"app_id": app_id})


def set_app_health(app_id: str, alive: bool, status: str = "") -> None:
    _get_store().update("apps", {"app_id": app_id}, {"alive": alive, "health_status": status, "last_seen": _now()})


def delete_app(app_id: str) -> dict:
    """Remove an app and everything tracked for it (test cases + runs).

    Returns a small summary of how many records were removed per collection.
    """
    store = _get_store()
    return {
        "apps": store.delete("apps", {"app_id": app_id}),
        "test_cases": store.delete("test_cases", {"app_id": app_id}),
        "test_runs": store.delete("test_runs", {"app_id": app_id}),
    }


# ---------------------------------------------------------------------------
# Test cases & runs
# ---------------------------------------------------------------------------
def add_test_case(doc: dict) -> dict:
    doc = dict(doc)
    doc.setdefault("case_id", _new_id())
    doc.setdefault("created", _now())
    return _get_store().insert("test_cases", doc)


def list_test_cases(app_id: str) -> list[dict]:
    return _get_store().all("test_cases", {"app_id": app_id})


def add_test_run(doc: dict) -> dict:
    """doc keys: app_id, workflow, status(passed|failed|inconclusive), summary,
    bug(dict|None), error, solution, mr_url, started, finished."""
    doc = dict(doc)
    doc.setdefault("run_id", _new_id())
    doc.setdefault("finished", _now())
    return _get_store().insert("test_runs", doc)


def list_test_runs(app_id: Optional[str] = None) -> list[dict]:
    return _get_store().all("test_runs", {"app_id": app_id} if app_id else None)


def latest_test_run(app_id: str) -> Optional[dict]:
    runs = list_test_runs(app_id)
    runs.sort(key=lambda r: r.get("finished", ""), reverse=True)
    return runs[0] if runs else None
