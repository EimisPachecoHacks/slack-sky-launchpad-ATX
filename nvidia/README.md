# Sky Launchpad — NVIDIA Backend (Slack UI)

The NVIDIA-hackathon variant of the Sky Launchpad backend: the same
self-improving cloud-deployment agent as `project/backend`, with every
hackathon-specific requirement swapped in. **This backend serves the Slack app**
(`slack/`, `SKY_API_URL=http://localhost:8020`); the canonical Qwen backend in
`project/` keeps serving the website.

| | Qwen backend (`project/`) | **NVIDIA backend (`nvidia/`)** |
|---|---|---|
| UI | Website (React) | **Slack app** (Block Kit) |
| Reasoning + IaC + failure diagnosis | Qwen on DashScope | **Nemotron 3 Nano 30B-A3B (BF16) on self-hosted vLLM** (A100 80GB box `sky-nvidia`) |
| Diagram vision | Qwen VL | **Nemotron Nano VL 8B via NVIDIA NIM API** |
| Skill embeddings | text-embedding-v4 (1024-d) | **llama-nemotron-embed-1b-v2 via NIM (1024-d, `input_type` asymmetric)** |
| Skills store | MongoDB Atlas Vector Search | **Supabase Postgres + pgvector (HNSW)** — table `learned_skills`, RPC `match_learned_skills` |
| Port | 8000 | **8020** |

## Why this maps to the hackathon

- **Recursive Intelligence track** — the agent learns from every deploy failure:
  diagnosis → `SKILL.md` → Nemotron embedding → Supabase pgvector → retrieved on
  the next run to pre-empt the same failure. Evidence:
  `backend/metrics/delta_report.py` (first-run vs last-run delta, skill reuse).
- **Best Use of vLLM** — ALL core inference (architecture reasoning, Terraform/
  CloudFormation generation, the failure-diagnosis heartbeat loop) runs on a
  vLLM server we operate. Small-model punch: the 30B MoE activates only ~3.5B
  params per token.
- **Best Use of Nemotron** — Nemotron is the only brain here: reasoning, code
  gen, diagnosis, vision, and embeddings are all Nemotron family models.
- **NemoClaw + OpenShell** — the deployer (live cloud credentials, real
  `terraform apply`) runs contained; see `nvidia/nemoclaw/` (policy + notes).

## Running

```bash
# 1) vLLM must be serving on the GPU box (systemd unit vllm-nano), and the
#    port-forward running on this machine:
brev port-forward sky-nvidia --port 8101:8001   # -> LLM_BASE_URL=http://localhost:8101/v1

# 2) Start this backend (port 8020):
cd nvidia
../project/venv/bin/python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8020

# 3) The Slack app already points here (slack/.env -> SKY_API_URL=http://localhost:8020)
cd ../slack && npm start
```

Configuration lives in `nvidia/.env` (gitignored). Key vars: `LLM_BASE_URL`
(vLLM), `LLM_MODEL`, `NVIDIA_API_KEY` (NIM vision + embeddings),
`SUPABASE_URL`/`SUPABASE_SERVICE_KEY` (skills store), `API_PORT=8020`.

## Sync with the canonical backend

All shared agent logic is mirrored from `project/backend` by
`scripts/sync-backends.sh` (run it after any improvement there). These paths
are PROTECTED (this backend's divergence) and never overwritten:

- `backend/config.py` — provider `nemotron`, NIM + Supabase settings
- `backend/llm_client.py` — vLLM chat, NIM vision/embeddings, `<think>` stripping
- `backend/skills_store/` — `migrate_from_qwen.py` (re-embeds skills across vector spaces)
- `backend/metrics/` — `delta_report.py` (Recursive Intelligence evidence)
- `backend/serving/`, `README.md`

The shared `skydb` layer (repo root) selects its store by environment:
`SUPABASE_URL` set → Supabase pgvector (this backend); `MONGODB_URI` set →
Atlas (Qwen backend); neither → local JSON. Embeddings are never copied between
backends — `migrate_from_qwen.py` re-embeds skill text into the Nemotron space.

## GPU box (`sky-nvidia`, Brev / Crusoe A100 80GB)

- vLLM systemd unit: `vllm-nano` (BF16 30B, `--gpu-memory-utilization 0.90`,
  `LD_LIBRARY_PATH=/usr/local/cuda-13.1/compat` for the CUDA 13 torch build on
  the r565 driver).
- Stop the instance from the Brev dashboard when idle — weights persist, billing ~stops.
