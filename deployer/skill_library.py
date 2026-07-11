"""
Sky Launchpad — Skill Library (Continual Learning Memory)

This module is the persistent MEMORY of the system's Continual Learning loop.
When the repair agent authors a new skill after a deployment failure, this
module persists it to BOTH:

  1. A versioned FILE:    skills/learned/<slug>/SKILL.md
  2. A RETRIEVAL INDEX:   skills/learned/_index.json

so that a FUTURE deployment can retrieve the lesson by similarity to a new
error / requirements text and pre-empt the same failure.

It mirrors the existing static-skill format (frontmatter: name, description,
metadata) and the `get_skills_context()` prompt-context shape from
`project/backend/skills_loader.py`.

Design constraints:
  - Works FULLY OFFLINE with NO external libraries (pure-python token-overlap
    cosine fallback).
  - Optional embedding path is imported LAZILY in try/except: only used when
    the embedding endpoint (skydb._embed_text) is reachable. Any failure
    silently falls back to the offline path.
  - stdlib only on the import path; Python 3.11; modern type hints.
"""

from __future__ import annotations

import json
import math
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
# deployer/ is one level under the repo root; skills live at <root>/skills.
SKILLS_DIR: Path = Path(__file__).resolve().parent.parent / "skills"
LEARNED_DIR: Path = SKILLS_DIR / "learned"
INDEX_FILE: Path = LEARNED_DIR / "_index.json"


def _dirs(repo_root: Path | None = None) -> tuple[Path, Path, Path]:
    """Resolve (skills_dir, learned_dir, index_file) honoring an optional
    repo_root override (used by tests to redirect into a temp dir)."""
    if repo_root is None:
        return SKILLS_DIR, LEARNED_DIR, INDEX_FILE
    skills = Path(repo_root) / "skills"
    learned = skills / "learned"
    return skills, learned, learned / "_index.json"


# --------------------------------------------------------------------------- #
# Slug / text helpers
# --------------------------------------------------------------------------- #
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _slugify(name: str) -> str:
    """Filesystem-safe kebab-case slug derived from a skill name."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug or "learned-skill"


def _tokenize(text: str) -> list[str]:
    """Lowercase word-boundary tokenization (pure python)."""
    return _TOKEN_RE.findall((text or "").lower())


def _tf_vector(text: str) -> Counter[str]:
    """Term-frequency vector for the offline cosine path."""
    return Counter(_tokenize(text))


def _cosine_counter(a: Counter[str], b: Counter[str]) -> float:
    """Cosine similarity between two term-frequency Counters."""
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def _cosine_vec(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two float vectors (embedding path)."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


# --------------------------------------------------------------------------- #
# Optional embedding path (lazy, best-effort, never required)
# --------------------------------------------------------------------------- #
def _embed(text: str) -> list[float] | None:
    """Delegate to skydb's canonical embedder so the file index and the Atlas
    index share ONE vector space. Returns None on any failure, so the caller
    falls back to the offline cosine path."""
    try:  # pragma: no cover - depends on the embedding service being reachable
        import skydb

        return skydb._embed_text(text)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Index I/O
# --------------------------------------------------------------------------- #
def _read_index(index_file: Path) -> dict[str, dict]:
    """Read the index keyed by slug. Returns {} if missing/corrupt."""
    if not index_file.exists():
        return {}
    try:
        data = json.loads(index_file.read_text(encoding="utf-8"))
    except Exception:
        return {}
    if not isinstance(data, dict):
        return {}
    return data


def _write_index(index_file: Path, index: dict[str, dict]) -> None:
    index_file.parent.mkdir(parents=True, exist_ok=True)
    index_file.write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


# --------------------------------------------------------------------------- #
# SKILL.md synthesis (mirrors existing frontmatter format)
# --------------------------------------------------------------------------- #
def _synthesize_markdown(skill: dict, slug: str) -> str:
    """Build a SKILL.md (frontmatter: name, description, metadata) from fields
    when the caller did not supply pre-rendered markdown."""
    name = skill.get("name", slug)
    description = (skill.get("description") or "").strip()
    error_sig = (skill.get("error_signature") or "").strip()
    root_cause = (skill.get("root_cause") or "").strip()
    fix_pattern = (skill.get("fix_pattern") or "").strip()

    # Frontmatter description must be a single folded block; keep it one line.
    desc_one_line = " ".join(description.split()) or "Learned skill auto-authored from a past deployment failure."

    lines = [
        "---",
        f"name: {name}",
        "description: >",
        f"  {desc_one_line}",
        "metadata:",
        "  slash-command: enabled",
        "  source: learned",
        f"  slug: {slug}",
        "---",
        "",
        f"## {name}",
        "",
        "> Auto-authored learned skill. Captured from a past deployment failure so a",
        "> future deployment can pre-empt the same problem.",
        "",
        "### Error Signature",
        "",
        "```",
        error_sig or "(none recorded)",
        "```",
        "",
        "### Root Cause",
        "",
        root_cause or "(none recorded)",
        "",
        "### Fix Pattern",
        "",
        fix_pattern or "(none recorded)",
        "",
    ]
    return "\n".join(lines)


def _resolve_skill_md(slug: str, repo_root: Path | None = None) -> Path:
    """Locate a learned skill's SKILL.md from its slug.

    The index used to store an absolute path, which broke whenever the repo was
    copied or renamed. The slug plus the learned dir is the real address.
    """
    _, learned_dir, _ = _dirs(repo_root)
    return learned_dir / slug / "SKILL.md"


def _read_skill_md(slug: str, repo_root: Path | None = None) -> str:
    """Read a learned skill's SKILL.md body, or '' if it is missing/unreadable."""
    try:
        p = _resolve_skill_md(slug, repo_root)
        return p.read_text(encoding="utf-8") if p.exists() else ""
    except Exception:
        return ""


def _body_excerpt(markdown: str, skill: dict, limit: int = 500) -> str:
    """Text used for retrieval matching: error_signature + description +
    first ~limit chars of the SKILL.md body."""
    parts = [
        skill.get("error_signature", "") or "",
        skill.get("description", "") or "",
        (markdown or "")[:limit],
    ]
    return "\n".join(p for p in parts if p)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def save_skill(new_skill: dict, repo_root: Path | None = None) -> dict:
    """Persist a learned skill to disk and upsert its index entry.

    new_skill = {name, description, error_signature, root_cause, fix_pattern, markdown}

    Writes skills/learned/<slug>/SKILL.md (uses new_skill['markdown']; if absent,
    synthesizes one from the fields). Upserts the index entry keyed by slug.

    Returns {slug, path, indexed: True, updated: bool}.
    """
    _, learned_dir, index_file = _dirs(repo_root)

    name = new_skill.get("name") or "learned-skill"
    slug = _slugify(name)

    markdown = new_skill.get("markdown")
    if not markdown:
        markdown = _synthesize_markdown(new_skill, slug)

    skill_dir = learned_dir / slug
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_path = skill_dir / "SKILL.md"
    skill_path.write_text(markdown, encoding="utf-8")

    index = _read_index(index_file)
    updated = slug in index
    existing = index.get(slug, {})

    excerpt = _body_excerpt(markdown, new_skill)
    embedding = _embed(excerpt)

    entry = {
        "slug": slug,
        "name": name,
        "description": new_skill.get("description", "") or "",
        "error_signature": new_skill.get("error_signature", "") or "",
        # Stored so the learning dashboard can render the error -> solution table.
        "root_cause": new_skill.get("root_cause", "") or "",
        "fix_pattern": new_skill.get("fix_pattern", "") or "",
        "provider": new_skill.get("provider", "") or "",
        "body_excerpt": excerpt,
        "embedding": embedding,
        # Repo-relative: an absolute path breaks the moment the repo is copied.
        # Readers resolve content from the slug anyway (see _resolve_skill_md).
        "path": f"skills/learned/{slug}/SKILL.md",
        # Preserve original creation time on update; otherwise stamp now.
        "created": existing.get("created") or datetime.now(timezone.utc).isoformat(),
        # Preserve accumulated hits across re-saves.
        "hit_count": int(existing.get("hit_count", 0)),
    }
    index[slug] = entry
    _write_index(index_file, index)

    # Mirror into the queryable store (MongoDB Atlas / local fallback). Best-effort:
    # the SKILL.md file + JSON index remain the agent/GitLab source; skydb powers dashboards.
    try:
        import skydb
        skydb.upsert_skill({
            "slug": slug,
            "name": name,
            "description": entry["description"],
            "error_signature": entry["error_signature"],
            "root_cause": entry.get("root_cause", ""),
            "fix_pattern": entry.get("fix_pattern", ""),
            "provider": entry.get("provider", ""),
            "embedding": entry.get("embedding"),
            "markdown_path": str(skill_path),
            "created": entry["created"],
            "hit_count": entry["hit_count"],
        })
    except Exception:
        pass

    return {
        "slug": slug,
        "path": str(skill_path),
        "indexed": True,
        "updated": updated,
    }


def retrieve_skills(query: str, k: int = 3, repo_root: Path | None = None) -> list[dict]:
    """Similarity-match `query` against learned skills and return up to k matches
    sorted by score descending. Returns [] when there are none.

    Each result: {slug, name, description, error_signature, score, content, path}.
    """
    _, _, index_file = _dirs(repo_root)
    index = _read_index(index_file)
    if not index or not (query or "").strip():
        # With no query we cannot rank; with no index there's nothing to return.
        if not index:
            return []

    # Decide on retrieval mode: try the embedding path only if EVERY entry has
    # a stored vector and we can embed the query. Otherwise use offline cosine.
    query_vec = _embed(query) if query else None
    use_embeddings = (
        query_vec is not None
        and bool(index)
        and all(isinstance(e.get("embedding"), list) and e["embedding"] for e in index.values())
    )

    query_tf = _tf_vector(query)

    scored: list[dict] = []
    for slug, entry in index.items():
        if use_embeddings:
            score = _cosine_vec(query_vec or [], entry.get("embedding") or [])
        else:
            score = _cosine_counter(query_tf, _tf_vector(entry.get("body_excerpt", "")))

        content = _read_skill_md(slug, repo_root)

        scored.append(
            {
                "slug": slug,
                "name": entry.get("name", slug),
                "description": entry.get("description", ""),
                "error_signature": entry.get("error_signature", ""),
                "score": round(float(score), 6),
                "content": content,
                "path": str(_resolve_skill_md(slug, repo_root)),
            }
        )

    scored.sort(key=lambda r: r["score"], reverse=True)
    # Drop zero-score noise so callers don't act on irrelevant lessons.
    scored = [r for r in scored if r["score"] > 0.0]
    return scored[: max(0, k)]


def get_learned_skills_context(query: str | None = None, k: int = 3) -> str:
    """Format retrieved (or all, when query is None) learned skills into a
    prompt-context string mirroring get_skills_context(). Returns '' if none."""
    if query is not None:
        results = retrieve_skills(query, k=k)
    else:
        index = _read_index(INDEX_FILE)
        results = []
        for slug, entry in index.items():
            results.append(
                {
                    "slug": slug,
                    "name": entry.get("name", slug),
                    "description": entry.get("description", ""),
                    "error_signature": entry.get("error_signature", ""),
                    "score": 1.0,
                    "content": _read_skill_md(slug),
                    "path": str(_resolve_skill_md(slug)),
                }
            )

    if not results:
        return ""

    sections = [
        "=== LEARNED SKILLS (auto-authored from past failures) ===",
        "",
        "The following lessons were learned from previous deployment failures.",
        "Apply them proactively to avoid repeating the same mistakes.",
        "",
    ]
    for r in results:
        sections.append(f"--- LEARNED SKILL: {r['slug']} ---")
        body = r.get("content") or ""
        if not body:
            # Fall back to a compact rendering if the file is unavailable.
            body = "\n".join(
                p
                for p in (
                    f"name: {r.get('name', '')}",
                    f"description: {r.get('description', '')}",
                    f"error_signature: {r.get('error_signature', '')}",
                )
                if p.strip().split(":", 1)[-1].strip()
            )
        sections.append(body)
        sections.append("")

    sections.append("=== END LEARNED SKILLS CONTEXT ===")
    return "\n".join(sections)


def list_learned_skills() -> list[dict]:
    """Return index entries for the metrics endpoint. [] if the index is missing."""
    index = _read_index(INDEX_FILE)
    out: list[dict] = []
    for slug, entry in index.items():
        out.append(
            {
                "slug": slug,
                "name": entry.get("name", slug),
                "description": entry.get("description", ""),
                "error_signature": entry.get("error_signature", ""),
                "created": entry.get("created"),
                "hit_count": int(entry.get("hit_count", 0)),
            }
        )
    return out


def record_hit(slug: str) -> None:
    """Increment hit_count for a learned skill. Safe no-op if slug missing."""
    index = _read_index(INDEX_FILE)
    entry = index.get(slug)
    if not entry:
        return
    entry["hit_count"] = int(entry.get("hit_count", 0)) + 1
    _write_index(INDEX_FILE, index)


# --------------------------------------------------------------------------- #
# Offline self-test
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import tempfile

    # Use an isolated temp repo root so we NEVER pollute the real skills/learned.
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)

        save_skill(
            {
                "name": "Enable Compute Engine API",
                "description": "Compute Engine API must be enabled before creating instances.",
                "error_signature": (
                    "Error 403: Compute Engine API has not been used in project "
                    "before or it is disabled. compute.googleapis.com"
                ),
                "root_cause": "The compute.googleapis.com service was not enabled on the project.",
                "fix_pattern": "Run `gcloud services enable compute.googleapis.com` or add "
                "google_project_service for compute before compute resources.",
            },
            repo_root=root,
        )

        save_skill(
            {
                "name": "Globally Unique Bucket Name",
                "description": "Cloud Storage bucket names must be globally unique.",
                "error_signature": (
                    "Error 409: The requested bucket name is not available. "
                    "bucket name already exists / conflict."
                ),
                "root_cause": "Bucket name collided with an existing global GCS name.",
                "fix_pattern": "Suffix bucket names with the project id or a random hash.",
            },
            repo_root=root,
        )

        results = retrieve_skills(
            "compute.googleapis.com has not been enabled",
            k=3,
            repo_root=root,
        )

        assert results, "expected at least one retrieval result"
        top = results[0]
        assert top["slug"] == "enable-compute-engine-api", (
            f"expected compute skill first, got {top['slug']} "
            f"(scores: {[(r['slug'], r['score']) for r in results]})"
        )
        assert top["score"] > 0.0, "top score should be positive"

        # Index round-trips and content is present.
        idx = _read_index(root / "skills" / "learned" / "_index.json")
        assert set(idx) == {"enable-compute-engine-api", "globally-unique-bucket-name"}
        assert "Compute Engine API" in top["content"], "SKILL.md content should be returned"

        # Upsert semantics: re-saving flips updated -> True and preserves hits.
        again = save_skill(
            {"name": "Enable Compute Engine API", "description": "x", "error_signature": "y"},
            repo_root=root,
        )
        assert again["updated"] is True, "re-save should report updated=True"

        print("Ranked retrieval:")
        for r in results:
            print(f"  {r['score']:.4f}  {r['slug']}")
        print("PASS")
