# Skyrchitect — companion application (`project/`)

**React + FastAPI** UI for **architecture design**, **Terraform code generation**, and **real cloud deployment** — powered by **Gemma 4 on an AMD MI300X** (text + diagram vision), with an optional GitLab Duo surface.

See the **[repository root README](../README.md)** for the full story (GitLab Duo flow, skills, Cloud Run deployment, and repo layout).

## What this folder contains

- **`src/`** — Vite + React + TypeScript (architecture, code, deployment pages, Zustand store)
- **`backend/`** — FastAPI app (`api/main.py`), Duo client (`duo_client.py`), agents, GitLab client
- **`public/`** — Static assets served with the UI
- **`.env` / `.env.example`** — API keys and `VITE_API_URL` (create `.env` from example)

The Python **`deployer`** package lives at **repo root** (`../deployer/`); the backend adds that path at runtime for `terraform` workflows.

## Prerequisites

- Node.js 18+
- Python 3.11+ (3.12 recommended)
- A reachable **AMD GPU inference endpoint** (Ollama serving `gemma4:31b`) — no API key needed
- *(optional)* **GitLab** personal access token (`GITLAB_TOKEN`) for the Duo surface + merge requests

## Setup

```bash
cd project
cp .env.example .env
# Edit .env — defaults point at the local AMD GPU (no API key):
#   LLM_BASE_URL=http://localhost:11434/v1  LLM_MODEL=gemma4:31b
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
| **Architecture** | Text requirements → **Gemma 4** on the MI300X → structured diagram + components |
| **Image flow** | **Gemma 4** reads the uploaded diagram directly (natively multimodal) → structured JSON |
| **Code** | Duo generates **Terraform** (primary) with project **skills** / **AGENTS.md** context |
| **Deploy** | **Real** `terraform init/plan/apply` to **AWS** or **GCP** using uploaded credentials |
| **GitLab** | After successful apply, backend can create branch / commit / **merge request** |

## Production / Cloud Run

The **production container** is built from the **monorepo root** [`Dockerfile`](../Dockerfile) (not `project/Dockerfile` alone): multi-stage build of this frontend + backend + `deployer` + Terraform. See the [root README](../README.md) for `gcloud builds submit` / `gcloud run deploy`.

## Configuration reference

| Variable | Role |
|----------|------|
| `LLM_BASE_URL` | Inference endpoint (default Ollama `:11434/v1`) |
| `LLM_MODEL` | Default `gemma4:31b` |
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
