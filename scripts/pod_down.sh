#!/usr/bin/env bash
# Stop the GPU services. The 8h/24h hackathon budget only burns while they run.
set -uo pipefail

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

say "Stopping Whisper shim"
pkill -f "services/whisper_server.py" && echo "  stopped" || echo "  not running"

say "Stopping Ollama"
pkill -f "ollama serve" && echo "  stopped" || echo "  not running"

say "Remaining GPU processes"
command -v rocm-smi >/dev/null 2>&1 && rocm-smi --showpids || echo "  (rocm-smi unavailable)"
