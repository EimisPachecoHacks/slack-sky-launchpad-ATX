# Sky Launchpad — Compliance Report

**Hackathon:** Global AI Hackathon with Qwen Cloud
**Track:** Track 4 — Autopilot Agent

This report maps each submission requirement to concrete evidence in the repo.

## Hard requirements

| Requirement | Status | Evidence |
|---|---|---|
| **Use Qwen models on Qwen Cloud** | ✅ MET | Every model call goes through Qwen Cloud (Alibaba Model Studio) via the OpenAI-compatible endpoint — [`project/backend/llm_client.py`](project/backend/llm_client.py). Models: `qwen3.7-max` (reasoning + IaC + repair), `qwen3.7-plus` (diagram vision), `text-embedding-v4` (skill retrieval), `qwen3-asr-flash` (voice). |
| **Proof of Alibaba Cloud deployment** | ✅ MET | Backend is containerized ([`Dockerfile.backend`](Dockerfile.backend), Terraform pre-installed) and runs on an Alibaba Cloud Simple Application Server / ECS instance. Submit a screenshot of the Workbench Overview showing the running instance. |
| **Public open-source repo with license** | ✅ MET | [`LICENSE`](LICENSE) — MIT, detectable at the repo root. |
| **Architecture diagram** | ✅ MET | Mermaid diagram in [`README.md`](README.md#how-it-works). |
| **≤ 3-minute demo video** | ⏳ TODO | Script in [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md); record and link on Devpost. |
| **Written summary** | ✅ MET | [`DEVPOST.md`](DEVPOST.md). |
| **Track identification** | ✅ MET | Track 4 — Autopilot Agent (stated in README and DEVPOST). |
| **Newly created / significantly updated in the submission period** | ✅ MET | The Qwen Cloud + Alibaba Cloud implementation was built during the submission period; git history documents the work. |

## How Qwen Cloud is used (Technical Depth)

Qwen Cloud is load-bearing across the whole autopilot workflow, not a single bolted-on call:

| Stage | Model | File |
|---|---|---|
| Architecture reasoning + IaC generation | `qwen3.7-max` | [`agents/architecture_agent.py`](project/backend/agents/architecture_agent.py), [`api/main.py`](project/backend/api/main.py) `/api/code/generate` |
| Diagram vision (image → structured JSON) | `qwen3.7-plus` | [`agents/image_analysis_agent.py`](project/backend/agents/image_analysis_agent.py) |
| Failure repair + skill authoring | `qwen3.7-max` | [`deployer/repair_agent.py`](deployer/repair_agent.py) |
| Skill-retrieval embeddings | `text-embedding-v4` (1024-d) | [`skydb/__init__.py`](skydb/__init__.py) |
| Voice input | `qwen3-asr-flash` | [`api/main.py`](project/backend/api/main.py) `/api/voice/transcribe` |

Learned skills from past failures are injected into code generation, so the self-improving loop and Qwen generation are directly coupled.

## Deploy target (use of the sponsor platform)

The app doesn't only *host* on Alibaba Cloud — it *generates and applies* `alicloud` Terraform ([`deployer/iac_generator.py`](deployer/iac_generator.py) → OSS bucket + VPC + VSwitch + security group) using a RAM AccessKey ([`deployer/credential_manager.py`](deployer/credential_manager.py)). Qwen builds real Alibaba Cloud infrastructure end to end. AWS/GCP/Azure remain supported as additional targets.

## Containerization

The backend image ([`Dockerfile.backend`](Dockerfile.backend)) is `python:3.11-slim` with Terraform 1.7.5 pre-installed, so `terraform init/plan/apply` runs inside the container. Qwen Cloud is a hosted API, so no GPU or model server is needed — the container only needs `DASHSCOPE_API_KEY`.

## Reproduce the compliance checks

1. **Qwen Cloud reachable with your key:**
   ```bash
   curl https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions \
     -H "Authorization: Bearer $DASHSCOPE_API_KEY" -H 'Content-Type: application/json' \
     -d '{"model":"qwen3.7-max","messages":[{"role":"user","content":"ping"}]}'
   ```
2. **Embeddings return 1024-d:** see the `curl` in [`README.md`](README.md#run-it).
3. **Config guard:** `LLM_PROVIDER` only accepts `qwen` ([`config.py`](project/backend/config.py)); any other value raises at startup.
4. **Backend on Alibaba Cloud:** `curl http://<instance-ip>:8080/` → `{"status":"ok",...}`, then screenshot the Workbench.

## Licensing

All inference is via the commercial Qwen Cloud API (free trial credits provided). Application frameworks (FastAPI, React, Vite, pymongo) are MIT/Apache-2.0. Terraform CLI is BUSL-1.1 (invoked, not redistributed; [OpenTofu](https://opentofu.org) is a drop-in). Full table in [`README.md`](README.md#models--licensing).
