#!/usr/bin/env python3
"""Re-embed every skill after switching to the AMD-served embedding model.

The old vectors came from Gemini (`gemini-embedding-001`, unpinned dimension).
The new ones come from `BAAI/bge-large-en-v1.5` (1024-d) served by vLLM on the
AMD GPU. The two spaces are not comparable, so every stored vector must be
recomputed — not just the missing ones.

Run this ONCE, after `vllm-embed` is up, and after recreating the Atlas index:

    Atlas -> Search -> create a Vector Search index named $MONGODB_VECTOR_INDEX
    on the `skills` collection:

        {
          "fields": [{
            "type": "vector",
            "path": "embedding",
            "numDimensions": 1024,
            "similarity": "cosine"
          }]
        }

Then:

    EMBED_BASE_URL=http://localhost:8001/v1 python3 scripts/migrate_vector_index.py

Safe to re-run. Without MONGODB_URI it operates on the local JSON store.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import skydb


def main() -> int:
    info = skydb.backend_info()
    print(f"store backend : {info['backend']}")
    print(f"embed model   : {skydb._EMBED_MODEL}")
    print(f"embed dims    : {skydb._EMBED_DIMENSIONS}")
    print(f"embed base_url: {skydb._EMBED_BASE_URL}")
    print()

    # Fail loudly rather than silently writing a lexical-only index.
    probe = skydb._embed_text("connectivity probe")
    if probe is None:
        print("❌ embedding endpoint unreachable — start vllm-embed first.")
        print("   (Nothing was written. Retrieval would fall back to lexical cosine.)")
        return 1
    if len(probe) != skydb._EMBED_DIMENSIONS:
        print(f"❌ dimension mismatch: endpoint returned {len(probe)}, "
              f"EMBED_DIMENSIONS={skydb._EMBED_DIMENSIONS}")
        print("   Fix EMBED_DIMENSIONS (and the Atlas index) before migrating.")
        return 1
    print(f"✅ endpoint healthy, returned {len(probe)}-d vector")

    skills = skydb.list_skills()
    if not skills:
        print("no skills to migrate.")
        return 0

    n = skydb.backfill_skill_embeddings(force=True)
    print(f"✅ re-embedded {n}/{len(skills)} skill(s) into the {skydb._EMBED_MODEL} space")

    # Prove the vector path actually serves results now.
    sample = skills[0]
    hits = skydb.find_similar_skills(sample.get("error_signature") or sample["slug"], k=3)
    print(f"\nretrieval check — {len(hits)} hit(s) for {sample['slug']!r}:")
    for h in hits:
        score = h.get("score")
        print(f"  {h['slug']}  score={score if score is not None else '(lexical)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
