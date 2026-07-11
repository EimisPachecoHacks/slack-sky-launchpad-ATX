# Skyrchitect — companion application (`project/`)

**React + FastAPI** UI for **architecture design**, **Terraform code generation**, and **real cloud deployment** — powered by **Qwen on Qwen Cloud** (text + diagram vision).

See the **[repository root README](../README.md)** for the full story (Qwen models, Alibaba Cloud deploys, the self-improving loop, and repo layout).

## What this folder contains

- **`src/`** — Vite + React + TypeScript (architecture, code, deployment pages, Zustand store)
- **`backend/`** — FastAPI app (`api/main.py`), Duo client (`duo_client.py`), agents, GitLab client
- **`public/`** — Static assets served with the UI
- **`.env` / `.env.example`** — API keys and `VITE_API_URL` (create `.env` from example)

The Python **`deployer`** package lives at **repo root** (`../deployer/`); the backend adds that path at runtime for `terraform` workflows.

## Prerequisites

- Node.js 18+
- Python 3.11+ (3.12 recommended)
- A reachable **Qwen Cloud inference endpoint** (Qwen Cloud serving `qwen3.7-max`) — no API key needed
- *(optional)* **GitLab** personal access token (`GITLAB_TOKEN`) for the Duo surface + merge requests

## Setup

```bash
cd project
cp .env.example .env
# Edit .env — defaults point at Qwen Cloud (needs DASHSCOPE_API_KEY):
#   LLM_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1  LLM_MODEL=qwen3.7-max
#   VITE_API_URL=http://localhost:8080
#   (optional) GITLAB_TOKEN, GITLAB_PROJECT_PATH for the Duo surface

pip install -r backend/requirements.txt
npm install
```

## Run locally

```bash
# Terminal 1 — from project/
uvicorn backend.api.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 — from project/
npm run dev
```

The backend adds the **monorepo root** to `sys.path` when running **deploy** and **credential** routes, so `deployer/` imports resolve without extra `PYTHONPATH`.

Open **http://localhost:5173**. The UI calls **`VITE_API_URL`** (typically the FastAPI origin).

## Features (current behavior)

| Area | Behavior |
|------|----------|
| **Architecture** | Text requirements → **Qwen (qwen3.7-max)** on Qwen Cloud → structured diagram + components |
| **Image flow** | **Qwen (qwen3.7-max)** reads the uploaded diagram directly (natively multimodal) → structured JSON |
| **Code** | Duo generates **Terraform** (primary) with project **skills** / **AGENTS.md** context |
| **Deploy** | **Real** `terraform init/plan/apply` to **AWS** or **GCP** using uploaded credentials |
| **GitLab** | After successful apply, backend can create branch / commit / **merge request** |

## Production / Cloud Run

The **production container** is built from the **monorepo root** [`Dockerfile`](../Dockerfile) (not `project/Dockerfile` alone): multi-stage build of this frontend + backend + `deployer` + Terraform. See the [root README](../README.md) for `gcloud builds submit` / `gcloud run deploy`.

## Configuration reference

| Variable | Role |
|----------|------|
| `LLM_BASE_URL` | Inference endpoint (default Qwen Cloud ` Qwen Cloud endpoint`) |
| `LLM_MODEL` | Default `qwen3.7-max` |
| `GITLAB_TOKEN` | GitLab REST + Duo |
| `GITLAB_PROJECT_PATH` | `namespace/project` |
| `GITLAB_URL` | e.g. `https://gitlab.com` |
| `VITE_API_URL` | Frontend → backend (build-time for production) |
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) |

## Scripts

- `npm run dev` — Vite dev server  
- `npm run build` — production frontend bundle  
- `npm run lint` / `npm run type-check` — quality gates  

Backend tests live under `backend/tests/` (run from `project/` with pytest; see `backend/pytest.ini`).

## License

Same as the monorepo — [MIT License](../LICENSE).
