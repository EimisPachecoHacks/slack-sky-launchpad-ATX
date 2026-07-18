#!/bin/bash
# Sync shared backend code: project/backend (canonical, Qwen/website) -> nvidia/backend (Nemotron/Slack).
#
# Make ALL improvements in project/backend first, then run this script.
# PROTECTED paths are the NVIDIA backend's hackathon-specific divergence and are
# never overwritten. Everything else is mirrored exactly (including deletions).
#
# Usage:
#   scripts/sync-backends.sh          # sync + run both test suites
#   scripts/sync-backends.sh --dry    # show what would change, touch nothing
#   scripts/sync-backends.sh --no-test
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="project/backend/"
DST="nvidia/backend/"

# NVIDIA-side divergence (see docs/NVIDIA_BACKEND_PLAN.md). Paths relative to backend/.
PROTECTED=(
  "config.py"          # provider/model/endpoint divergence (Nemotron + vLLM)
  "llm_client.py"      # provider-specific client tweaks, if any
  "README.md"
  "serving/"           # vLLM launch scripts (NVIDIA only)
  "metrics/"           # run-over-run delta report (NVIDIA only)
  "skills_store/"      # Supabase/pgvector adapter (NVIDIA only)
)

DRY=""
RUN_TESTS=1
for arg in "${@:-}"; do
  case "$arg" in
    --dry) DRY="--dry-run" ;;
    --no-test) RUN_TESTS=0 ;;
  esac
done

EXCLUDES=(--exclude='__pycache__' --exclude='.pytest_cache' --exclude='*.pyc')
for p in "${PROTECTED[@]}"; do EXCLUDES+=(--exclude="/$p"); done

echo "── Syncing $SRC → $DST (protected: ${PROTECTED[*]})"
rsync -a --delete $DRY --itemize-changes "${EXCLUDES[@]}" "$SRC" "$DST" | sed 's/^/   /' || true

[ -n "$DRY" ] && { echo "── Dry run only — nothing changed."; exit 0; }

if [ "$RUN_TESTS" = "1" ]; then
  PY="project/venv/bin/python"
  echo "── Tests: Qwen backend (project/)"
  (cd project && "../$PY" -m pytest backend/tests -q -x 2>&1 | tail -3)
  echo "── Tests: NVIDIA backend (nvidia/)"
  (cd nvidia && "../$PY" -m pytest backend/tests -q -x 2>&1 | tail -3)
fi
echo "── Sync complete."
