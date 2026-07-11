#!/usr/bin/env bash
# Bring up the Sky Launchpad AMD stack on the hackathon GPU pod.
#
# The pod (notebooks.amd.com/hackathon = AMD Accelerator Cloud) is a MANAGED
# JupyterLab container: you are root inside a container, but you cannot
# `docker run`. So everything here installs with pip/curl and runs as a plain
# process. For a real Docker host (an AMD Developer Cloud droplet), use
# docker/docker-compose.amd.yml instead.
#
# Everything below runs on the MI300X:
#   ollama          :11434  gemma4:31b (chat + vision) and mxbai-embed-large (1024-d)
#   whisper_server  :8100   openai/whisper-large-v3
#   backend         :8080   FastAPI
#
# Usage:
#   bash scripts/pod_up.sh            # install + serve
#   bash scripts/pod_up.sh --check    # environment checks only, no install
#
# The GPU clock runs while these are up. `bash scripts/pod_down.sh` stops them.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_ROOT}/.pod-logs"
mkdir -p "$LOG_DIR"

LLM_MODEL="${LLM_MODEL:-gemma4:31b}"
EMBED_MODEL="${EMBED_MODEL:-mxbai-embed-large}"
WHISPER_MODEL="${WHISPER_MODEL:-openai/whisper-large-v3}"

say() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

# --------------------------------------------------------------------------
# 0. Environment checks. These three minutes resolve most "why is it on CPU"
#    questions before you burn GPU hours.
# --------------------------------------------------------------------------
say "Environment"
echo "  python : $(python3 --version 2>&1)"
if have rocminfo; then
  echo "  gfx    : $(rocminfo 2>/dev/null | grep -m1 -o 'gfx[0-9a-z]*' || echo '(none found)')  # MI300X = gfx942"
else
  echo "  gfx    : rocminfo not found — is this really a GPU pod?"
fi
[ -r /opt/rocm/.info/version ] && echo "  rocm   : $(cat /opt/rocm/.info/version)" || echo "  rocm   : /opt/rocm/.info/version missing"
if have docker && docker info >/dev/null 2>&1; then
  echo "  docker : usable (you could use docker/docker-compose.amd.yml instead)"
else
  echo "  docker : NOT usable — correct, this script avoids it"
fi
have ffmpeg && echo "  ffmpeg : $(ffmpeg -version 2>/dev/null | head -1)" \
            || echo "  ffmpeg : MISSING — browser webm/opus audio will NOT decode (apt-get install -y ffmpeg)"

if [ "${1:-}" = "--check" ]; then
  say "Checks only; exiting."
  exit 0
fi

# --------------------------------------------------------------------------
# 1. Ollama with its bundled ROCm runtime. Installs as a plain binary.
# --------------------------------------------------------------------------
if ! have ollama; then
  say "Installing Ollama (ROCm build)"
  curl -fsSL https://ollama.com/install.sh | sh
  # The base install is CPU-only; the ROCm package supplies the GPU runtime.
  curl -fsSL https://ollama.com/download/ollama-linux-amd64-rocm.tar.zst \
    | tar -x --zstd -C /usr 2>/dev/null \
    || echo "  (ROCm tarball step failed — check GPU use below; the install script may have covered it)"
else
  say "Ollama already installed: $(ollama --version 2>&1 | head -1)"
fi

say "Starting Ollama on :11434"
if curl -sf http://localhost:11434/api/version >/dev/null 2>&1; then
  echo "  already running"
else
  OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf http://localhost:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf http://localhost:11434/api/version >/dev/null 2>&1 \
    || { echo "  ollama failed to start; see $LOG_DIR/ollama.log"; exit 1; }
  echo "  up"
fi

say "Pulling models (first run downloads several GB)"
ollama pull "$LLM_MODEL"
ollama pull "$EMBED_MODEL"

# Confirm the model actually landed on the GPU rather than silently on CPU.
say "GPU residency"
ollama ps || true
echo "  ^ PROCESSOR column must say 'GPU'. If it says 'CPU', the ROCm runtime is not active."

# --------------------------------------------------------------------------
# 2. Whisper shim (speech-to-text) on the same GPU.
# --------------------------------------------------------------------------
say "Starting Whisper shim on :8100"
if curl -sf http://localhost:8100/health >/dev/null 2>&1; then
  echo "  already running"
else
  python3 -c "import transformers, fastapi" 2>/dev/null || {
    echo "  installing whisper deps..."
    pip install -q fastapi uvicorn python-multipart transformers accelerate
  }
  WHISPER_MODEL="$WHISPER_MODEL" nohup python3 "$REPO_ROOT/services/whisper_server.py" \
    > "$LOG_DIR/whisper.log" 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf http://localhost:8100/health >/dev/null 2>&1 && break
    sleep 1
  done
  curl -sf http://localhost:8100/health >/dev/null 2>&1 \
    && echo "  up (weights load lazily on first transcription)" \
    || echo "  WARNING: whisper did not come up; see $LOG_DIR/whisper.log (voice input will 500)"
fi

# --------------------------------------------------------------------------
# 3. Point the app at all of it.
# --------------------------------------------------------------------------
say "Backend environment"
cat <<EOF
Export these (or put them in project/.env), then start the API:

  export LLM_PROVIDER=amd
  export LLM_BASE_URL=http://localhost:11434/v1
  export LLM_MODEL=$LLM_MODEL
  export LLM_VISION_MODEL=$LLM_MODEL
  export EMBED_BASE_URL=http://localhost:11434/v1
  export EMBED_MODEL=$EMBED_MODEL
  export EMBED_DIMENSIONS=1024
  export LLM_AUDIO_BASE_URL=http://localhost:8100/v1
  export LLM_TRANSCRIBE_MODEL=$WHISPER_MODEL

  cd project && uvicorn backend.api.main:app --host 0.0.0.0 --port 8080

Verify the GPU is doing the work:

  rocm-smi
  curl -s localhost:11434/v1/embeddings -H 'Content-Type: application/json' \\
    -d '{"model":"$EMBED_MODEL","input":"compute api disabled"}' \\
    | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"][0]["embedding"]), "dims")'   # -> 1024

One-time, after creating the Atlas index with numDimensions: 1024:

  python3 scripts/migrate_vector_index.py

Show it to judges (the pod has no public IP you control):

  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
  chmod +x cloudflared && ./cloudflared tunnel --url http://localhost:8080

  NOTE: cloudflared *quick* tunnels do not support SSE and cap at 200 concurrent
  requests. The narration WebSocket may misbehave; if so use ngrok (free
  authtoken required) or demo from inside the pod.
EOF

say "Up. Logs in $LOG_DIR/"
