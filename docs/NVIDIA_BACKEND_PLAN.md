# Dual-Backend Plan: Qwen (Website) + NVIDIA (Slack UI)

> Reference document — created 2026-07-18. Plan for maintaining two synchronized
> backends: the existing Qwen Cloud backend (Devpost hackathon, website UI) and a
> new NVIDIA backend (Recursive Intelligence hackathon + vLLM/Nemotron bounties,
> Slack UI). **No Featherless** — inference is self-hosted vLLM only.

---

## 1. Architecture overview

| | Qwen backend (existing, FROZEN) | NVIDIA backend (new) |
|---|---|---|
| Folder | `project/backend/` — **zero changes before July 20** | `nvidia/backend/` — starts as a copy |
| Serves | Website (`VITE_API_URL` → port **8000**) | Slack app (`slack/.env` `SKY_API_URL` → port **8010**) |
| Hackathon | Devpost / Qwen Cloud — Autopilot Agent track | Recursive Intelligence track + vLLM & Nemotron bounties |
| Inference | Qwen on DashScope (untouched) | **Nemotron served by self-hosted vLLM** |
| Embeddings | text-embedding-v4 (1024-dim) | llama-nemotron-embed-1b-v2 (1024-dim) |
| Skills DB | MongoDB `sky_launchpad` | MongoDB `sky_launchpad_nvidia` (own vector index) |

Both backends are the **same product with the same behavior** — the self-improving
cloud-deployment agent. They differ only in inference provider, serving
infrastructure, and hackathon submission artifacts.

## 2. Sync mechanism ("same improvements for both")

`scripts/sync-backends.sh` with two explicit file lists:

- **SHARED list** (vast majority): agent logic, deployer integration, skill
  library, API routes, schemas, tests. One-way rsync
  `project/backend/` → `nvidia/backend/`. All improvements are made in the
  canonical Qwen backend first, then propagated by running the script.
- **PROTECTED list** (never overwritten by sync):
  - `config.py` (provider/model/endpoint divergence)
  - `.env.example`
  - `serving/` (vLLM launch scripts — NVIDIA only)
  - `metrics/` additions (run-over-run delta report — NVIDIA only)
  - `README.md` / docs
- The script ends by running **both** backends' test suites so a sync cannot
  silently break the NVIDIA copy.

**Skills transfer:** Qwen and Nemotron embeddings live in different vector
spaces — indexes cannot be shared even at equal dimensions. A small
**re-embed migration script** copies learned `SKILL.md` texts from the Qwen DB
and re-embeds them with the Nemotron embed model (and can run in reverse), so
lessons learned on either side reach both.

## 3. Model choices (NVIDIA backend)

| Workload | Model | Rationale |
|---|---|---|
| Architecture reasoning + Terraform/CloudFormation generation + failure-diagnosis loop | **Nemotron 3 Nano 30B-A3B** (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8`) | MoE, only 3.5B active params ("small-model punch"); trained on 26B tool-calling tokens; LiveCodeBench 68.3; reasoning-budget control keeps repeated diagnosis calls cheap; single 80GB GPU; vLLM-supported (`--reasoning-parser nano_v3`) |
| Diagram image analysis (Slack image upload) | **Nemotron Nano 12B v2 VL** (`nvidia/NVIDIA-Nemotron-Nano-12B-v2-VL-BF16`) | Built for diagram/chart/document understanding; 128K ctx; ~25GB BF16 (fits alongside Nano FP8 on one 80GB GPU, or NIM API as alternative); PDFs are rasterized to images first |
| Skill embeddings | **llama-nemotron-embed-1b-v2** (`nvidia/llama-nemotron-embed-1b-v2`) | Matryoshka output natively includes **1024 dims** — drop-in for the existing index shape; commercial license. (Do NOT use the 8B embed model — non-commercial license.) |
| Escalation option (if IaC quality needs more) | Llama-3.3-Nemotron-Super-49B-v1.5 (FP8) | Stronger coding (LiveCodeBench 73.58) on a single H100/H200 |

All chosen models: open weights on Hugging Face, NVIDIA Open Model License
(commercial OK).

## 4. Why vLLM (bounty analysis)

- One self-hosted vLLM endpoint serving Nemotron satisfies **both** the vLLM
  bounty (functional self-hosted vLLM doing real work) and the Nemotron bounty
  (Nemotron central to the agent).
- Our self-healing deploy loop makes many repeated log-diagnosis calls — the
  "heartbeat" concurrency pattern where vLLM's continuous batching and
  PagedAttention are demonstrably doing work (judged criterion: efficiency).
- Small MoE model + agent scaffolding = the "2B-that-punches-up" pattern the
  judges explicitly reward.
- Managed APIs do not qualify: the bounty demands self-hosted open
  infrastructure, so inference must genuinely run on our vLLM box.

## 5. Divergence details (`nvidia/backend/config.py`)

- `LLM_PROVIDER`: relax the current hard lock (`qwen` only) → `nemotron`.
- `LLM_BASE_URL`: default `http://<vllm-host>:8001/v1`.
- `LLM_MODEL`: `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-FP8`.
- `LLM_VISION_MODEL`: `nvidia/NVIDIA-Nemotron-Nano-12B-v2-VL-BF16` (second vLLM
  process or NIM endpoint).
- `EMBED_MODEL`: `nvidia/llama-nemotron-embed-1b-v2`, `EMBED_DIMENSIONS=1024`.
- `MONGODB_DB`: `sky_launchpad_nvidia`.
- `API_PORT`: 8010.
- Voice/ASR endpoints: disabled (Qwen ASR has no Nemotron equivalent; the Slack
  UI never uses voice).
- Prompts stay SHARED. Only if Nemotron output quality demands it, add a tiny
  provider-aware prompt shim as a protected file.

## 6. Execution phases

1. **Scaffold** — copy `project/backend/` → `nvidia/backend/`; write
   `scripts/sync-backends.sh` (SHARED/PROTECTED lists); run once to prove
   parity; NVIDIA backend on port 8010; point `slack/.env` `SKY_API_URL` at it.
2. **Stand up vLLM** — provision GPU; `vllm serve` Nemotron 3 Nano 30B FP8
   (+ 12B VL as second process or NIM); smoke-test OpenAI-compatible endpoint.
3. **Provider swap** — apply the `config.py` divergence; validate structured
   JSON / tool-call output on our real prompts (architecture → code →
   diagnosis); run the existing test suite against the NVIDIA backend.
4. **Embeddings + skills transfer** — wire embed-1b-v2; create
   `sky_launchpad_nvidia` vector index; run the re-embed migration from the
   Qwen skills DB.
5. **Recursive Intelligence evidence** — run-over-run delta report built on
   existing `skills/learned` + `learning/summary` (first-run vs last-run:
   retries, duration, `total_retries_avoided`); scripted demo: fresh skills DB
   → deploy fumbles/retries → re-run → clean deploy.
6. **Submission artifacts** — Nemotron write-up (what it does, why it matters),
   vLLM write-up (how it is genuinely in the loop, efficiency choices),
   architecture diagram showing both backends + sync, demo video.
7. *(Optional, separate decision)* NemoClaw + OpenShell containment of the
   deployer (policy-block `terraform destroy`, unapproved regions, credential
   exfiltration; human-in-the-loop escalation).

## 7. Requirements list

### Hardware / infrastructure
- [ ] **1× GPU with 80GB VRAM** (H100/H200/A100-80G) for vLLM serving
      Nano 30B FP8 (~30GB) + 12B VL BF16 (~25GB) together; or two smaller GPUs.
      Source: Brev credits (bounty prizes), cloud GPU quota, or hackathon box.
- [ ] Network access from the machine running `nvidia/backend` to the vLLM host.
- [ ] MongoDB Atlas (existing cluster is fine) — new DB `sky_launchpad_nvidia`
      with a 1024-dim vector index.

### Software
- [ ] vLLM (latest; hybrid-Mamba support required for Nemotron 3) on the GPU box.
- [ ] Model weights from Hugging Face:
      `NVIDIA-Nemotron-3-Nano-30B-A3B-FP8`,
      `NVIDIA-Nemotron-Nano-12B-v2-VL-BF16`,
      `llama-nemotron-embed-1b-v2`.
- [ ] vLLM launch flags: `--reasoning-parser nano_v3`, Qwen3 tool-call parser,
      `--trust-remote-code` where required.
- [ ] `rsync` (sync script), existing Python env for the backend copy.

### Accounts / access
- [ ] Hugging Face account (model downloads; accept NVIDIA license terms).
- [ ] build.nvidia.com account (optional NIM fallback for the VL model; free dev credits).
- [ ] GPU provider account (Brev / cloud).

### Repo work items
- [ ] `nvidia/backend/` (copy + protected divergence files)
- [ ] `scripts/sync-backends.sh` (SHARED/PROTECTED lists + dual test run)
- [ ] `nvidia/serving/` (vLLM launch scripts for the 3 models)
- [ ] Skills re-embed migration script
- [ ] Run-over-run metrics report endpoint/script
- [ ] `slack/.env` → `SKY_API_URL=http://localhost:8010`
- [ ] Bounty write-ups + architecture diagram + demo script

### Constraints / guardrails
- [ ] `project/backend/` untouched until the Qwen Devpost submission
      (deadline **July 20, 2:00 PM PDT**) is locked.
- [ ] Never mix embedding spaces: Qwen and Nemotron skills indexes stay separate;
      transfer via re-embedding only.
- [ ] All model licenses verified commercial-OK (avoid `llama-embed-nemotron-8b`).

---

*Research sources: NVIDIA Nemotron 3 announcements, Hugging Face model cards,
vLLM Nemotron serving guide, hackathon track/bounty text (see conversation of
2026-07-18 for full citations).*
