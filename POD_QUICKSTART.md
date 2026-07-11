# Pod Quickstart — running Sky Launchpad on the AMD GPU

A copy-paste runbook for the **AMD hackathon notebook pod**
(`notebooks.amd.com/hackathon`). Your pod image is **ROCm 7.2 + vLLM 0.16.0 +
PyTorch 2.9**, so the GPU stack is already installed — you mostly just start
processes.

> **The clock only runs while the session is live.** You have ~8 GPU-hours per
> rolling 24h. Do all editing/thinking locally (free); launch the notebook only
> to actually run on the GPU; hit **Turn-off Session** when you stop.

---

## 0. One-time: get the code onto the pod

Open a terminal inside JupyterLab: **File → New → Terminal**. Then:

```bash
# Replace with YOUR public repo URL (the one you push for the submission).
git clone https://github.com/<you>/<repo>.git sky
cd sky
```

To pull my later changes, just `git pull` in this same terminal.

*(If the pod exposes an SSH endpoint, you can skip git and let Claude Code drive
the pod directly — see §7.)*

---

## 1. Sanity-check the GPU (costs almost nothing)

```bash
bash scripts/pod_up.sh --check
```

Confirm in the output:

- `gfx : gfx942` — that's the MI300X. Anything else means a different GPU.
- `rocm` version prints (should be 7.x).
- `ffmpeg` — if it says **MISSING**, voice input won't decode browser audio.
  Fix now: `apt-get update && apt-get install -y ffmpeg` (you have root in the
  container). Skip if you're not demoing voice.

---

## 2. Serve Gemma 4 + embeddings (uses the preinstalled vLLM)

Your image already has vLLM 0.16.0, so serve straight from it. **Two processes,
two ports.** Run each in its own Jupyter terminal tab (they stay in the
foreground and stream logs).

**Terminal A — generation + vision (Gemma 4):**
```bash
vllm serve google/gemma-4-31b-it \
  --host 0.0.0.0 --port 8000 \
  --served-model-name gemma4
# First run downloads ~24 GB of weights. Wait for: "Application startup complete".
```

**Terminal B — embeddings (1024-d):**
```bash
vllm serve BAAI/bge-large-en-v1.5 \
  --task embed \
  --host 0.0.0.0 --port 8001 \
  --served-model-name bge-large
```

> **If a vLLM command errors** (Gemma 4 gating, ROCm multimodal quirks, or embed
> task unsupported), fall back to Ollama — it's the most forgiving path on ROCm:
> ```bash
> curl -fsSL https://ollama.com/install.sh | sh
> curl -fsSL https://ollama.com/download/ollama-linux-amd64-rocm.tar.zst | tar -x --zstd -C /usr
> OLLAMA_HOST=0.0.0.0:11434 ollama serve &      # then, in another terminal:
> ollama pull gemma4:31b && ollama pull mxbai-embed-large
> ```
> Ollama serves both models on **one** port (`11434`), so set both base URLs to
> `http://localhost:11434/v1` and use models `gemma4:31b` / `mxbai-embed-large`.

**Gated-model note:** `google/gemma-4-31b-it` on Hugging Face requires accepting
the Gemma license. Either accept it once on huggingface.co and
`export HF_TOKEN=hf_...` before `vllm serve`, **or** use the Ollama path above,
which pulls Gemma from Ollama's registry with no token.

**Prove the GPU is doing the work** (new terminal):
```bash
rocm-smi                      # models should show up as GPU memory users
curl localhost:8001/v1/embeddings -H 'Content-Type: application/json' \
  -d '{"model":"bge-large","input":"compute api disabled"}' \
  | python3 -c 'import json,sys; print(len(json.load(sys.stdin)["data"][0]["embedding"]), "dims")'
# -> 1024
```

---

## 3. (Optional) Whisper for voice input

Only if you're demoing the mic. Needs `ffmpeg` from §1.

```bash
pip install fastapi uvicorn python-multipart transformers accelerate
python3 services/whisper_server.py        # binds :8100
curl localhost:8100/health                # {"gpu": true, "hip": "..."} = AMD build
```

---

## 4. Point the backend at the GPU and start it

```bash
# vLLM path (from §2):
export LLM_PROVIDER=amd
export LLM_BASE_URL=http://localhost:8000/v1
export LLM_MODEL=gemma4
export LLM_VISION_MODEL=gemma4
export EMBED_BASE_URL=http://localhost:8001/v1
export EMBED_MODEL=bge-large
export EMBED_DIMENSIONS=1024
export LLM_AUDIO_BASE_URL=http://localhost:8100/v1     # only if §3 is running
# storage / MRs (optional):
export MONGODB_URI='...'                                # blank = local JSON fallback
export GITLAB_TOKEN='...'                               # blank = no MR

pip install -r project/backend/requirements.txt
cd project && uvicorn backend.api.main:app --host 0.0.0.0 --port 8080
```

> Using the **Ollama** fallback instead? Set both base URLs to
> `http://localhost:11434/v1`, `LLM_MODEL=gemma4:31b`, `EMBED_MODEL=mxbai-embed-large`.

---

## 5. Skill retrieval (MongoDB Atlas) — one-time

Skip if `MONGODB_URI` is unset (retrieval then uses the local JSON store).

1. In Atlas, create a **Vector Search index** on the `skills` collection:
   ```json
   { "fields": [ { "type": "vector", "path": "embedding",
                   "numDimensions": 1024, "similarity": "cosine" } ] }
   ```
2. Re-embed every skill with the GPU embedder:
   ```bash
   python3 scripts/migrate_vector_index.py
   ```
   It refuses to run (and writes nothing) if the embedding endpoint is down or
   returns the wrong width — that's the safety guard, not a bug.

---

## 6. The demo (this is the submission)

1. Show `rocm-smi` — Gemma 4 + embedder resident on one MI300X.
2. In the UI, describe an infra need → Gemma 4 returns architecture + Terraform.
3. `terraform apply` **fails** on a disabled GCP API.
4. Watch the narration: `failure → diagnose → learned → retry`.
5. `skills/learned/gcp-enable-compute-api/SKILL.md` gets authored.
6. **Re-run the identical request** → the skill is retrieved, the API is
   pre-enabled, **the failure never happens.** That's the whole pitch.

---

## 7. (Optional) Let Claude Code drive the pod directly

If the pod UI shows an **SSH endpoint** (host / port / password), add it to your
**local** `~/.ssh/config`:

```
Host amdpod
    HostName <pod-host>
    Port <pod-port>
    User <pod-user>
```

Then Claude Code can run `ssh amdpod '<cmd>'` and `rsync` files straight to the
pod from its own tools — no git round-trip, no copy-pasting output. Without SSH,
stick with the git + Jupyter-terminal loop (§0).

---

## Stop the clock

```bash
bash scripts/pod_down.sh      # kills ollama + whisper if started that way
# For vLLM started in foreground terminals: Ctrl-C each, or `pkill -f 'vllm serve'`.
```
Then hit **Turn-off Session** in the pod UI. The GPU budget stops burning only
once the session is actually off.
```
```

---

## If something breaks, tell me

Paste the failing command's output back into our chat. The most likely snags:

| Symptom | Cause | Fix |
|---|---|---|
| `ollama ps` / `rocm-smi` shows CPU | ROCm runtime didn't load | Restart the process; verify §1 showed `gfx942` |
| Gemma 4 vision returns garbage | vLLM multimodal on ROCm is fragile | Use Ollama for vision, or demo diagram upload last |
| `500` on voice transcribe | `ffmpeg` missing | `apt-get install -y ffmpeg` |
| `$vectorSearch` returns nothing | Atlas index missing/wrong dims | Recreate index at 1024-d, rerun §5 |
| Gemma download 401/403 | gated model, no token | `export HF_TOKEN=...` or use Ollama |
