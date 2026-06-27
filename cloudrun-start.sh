#!/bin/bash
set -e
cd /app
export PYTHONPATH=/app

echo "=== Starting Skyrchitect backend ==="

python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

echo "Waiting for uvicorn to be ready on port 8000..."
for i in $(seq 1 60); do
    if curl -sf http://127.0.0.1:8000/api/docs > /dev/null 2>&1; then
        echo "Uvicorn ready after ${i}s"
        break
    fi
    if ! kill -0 $UVICORN_PID 2>/dev/null; then
        echo "FATAL: uvicorn process died during startup"
        exit 1
    fi
    sleep 1
done

echo "=== Starting nginx ==="
nginx -g "daemon off;"
