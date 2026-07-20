#!/bin/bash
set -e
cd /app
export PYTHONPATH=/app

echo "=== Starting Skyrchitect backend ==="

# Supervise uvicorn: respawn it if it dies. A long terraform deploy can spike
# memory and get the worker OOM-killed; nginx (below) keeps the container up, so
# without this the API would stay dead until a manual container restart. The
# loop makes the backend self-heal.
(
  while true; do
    echo "[supervisor] starting uvicorn..."
    python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
    echo "[supervisor] uvicorn exited ($?); restarting in 2s"
    sleep 2
  done
) &

echo "Waiting for uvicorn to be ready on port 8000..."
for i in $(seq 1 60); do
    if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "Uvicorn ready after ${i}s"
        break
    fi
    sleep 1
done

echo "=== Starting nginx ==="
nginx -g "daemon off;"
