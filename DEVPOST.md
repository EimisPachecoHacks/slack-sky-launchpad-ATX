# Sky Launchpad

**An autopilot agent for cloud infrastructure that learns from its own failures — powered by Qwen models on Qwen Cloud, deploying to Alibaba Cloud.**

*Submitted to the Global AI Hackathon with Qwen Cloud — Track 4: Autopilot Agent*

---

## Inspiration

Every infrastructure tool makes the same mistake twice.

You ask an AI to generate Terraform. It picks an ECS instance type that isn't offered in the target zone. `terraform apply` fails. The AI patches it, you move on. Next week, a different project, a different prompt — and it picks an unavailable instance type again. The model never got worse, but it never got *better* either. Every deploy starts from zero.

That's not how engineers work. When an SRE hits a wall at 2am, they write it down. The runbook grows. The team gets faster. The knowledge compounds.

We wanted infrastructure automation that compounds. Not a bigger model — an **agent with memory**.

## What it does

Sky Launchpad turns natural language or an uploaded architecture diagram into Terraform, actually runs `terraform apply` against **Alibaba Cloud**, and opens a GitLab merge request when the infrastructure really stands up — an end-to-end workflow with a human checkpoint only where it matters: approving a real deploy.

The interesting part is what happens when it **fails**:

1. **Collect** — `deployer/log_collector.py` gathers the Terraform error and the exact HCL lines around it.
2. **Diagnose** — `deployer/repair_agent.py` hands that context to **`qwen3.7-max`**, which finds the root cause and rewrites the broken HCL.
3. **Author** — the same Qwen call writes a **new, generalized `SKILL.md`** — not "fix line 42", but "query available zones and pick a supported ecs instance type before creating the instance."
4. **Remember** — the skill is embedded by **`text-embedding-v4`** and indexed in MongoDB Atlas Vector Search.
5. **Transfer** — the *next* deployment retrieves matching skills by vector similarity and injects them into generation.

The same failure never happens twice. No human ever edits a skill.

Run a deploy that fails on an unavailable instance type, watch it repair itself and write `alicloud-supported-instance-type`. Run it again — the failure never occurs, because the lesson was retrieved before generation.

## How Qwen Cloud makes it work

**Qwen models are load-bearing across every stage** — this is not a single model call bolted onto a template engine.

| Role | Model | Endpoint |
|---|---|---|
| Architecture reasoning + IaC generation | **`qwen3.7-max`** | Qwen Cloud (OpenAI-compatible) |
| Failure repair + skill authoring | **`qwen3.7-max`** | Qwen Cloud |
| Diagram vision — screenshot → structured JSON | **`qwen3.7-plus`** | Qwen Cloud |
| Skill-retrieval embeddings | **`text-embedding-v4`** (1024-d) | Qwen Cloud |
| Speech-to-text (voice input) | **`qwen3-asr-flash`** | Qwen Cloud |

Everything speaks the OpenAI wire format through a single DashScope endpoint (`project/backend/llm_client.py`), so one `DASHSCOPE_API_KEY` and a model name drive chat, vision, embeddings, and speech alike. `qwen3.7-max` is Qwen's agent-frontier model, built for exactly this kind of long-horizon, tool-using autonomous workflow.

The self-improving loop rests on one design decision worth calling out: **embeddings have exactly one model, and no fallback.** Vectors from different models aren't comparable, so a "just swap embedders" fallback would silently poison the vector index with a foreign coordinate space. So when the embedding endpoint is unreachable, `skydb.find_similar_skills` **degrades to lexical matching** instead of corrupting the index. Semantic recall of past failures is a first-class, single-source-of-truth capability.

## How we built it

Everything the app touches speaks the **OpenAI wire format**, which collapses chat, vision, transcription, and embeddings into one small client:

- **`project/backend/llm_client.py`** — `chat`, `vision_chat`, `transcribe`, `embed`, all against the Qwen Cloud compatible endpoint.
- **`deployer/iac_generator.py`** — generates `alicloud` Terraform (OSS bucket + VPC + VSwitch + security group), plus AWS/GCP/Azure. The globally-unique OSS bucket name is deliberately the failure the learned-skill library pre-empts.
- **`deployer/repair_agent.py`** — the failure → repair → author-skill engine, on `qwen3.7-max`.
- **`skydb/`** — MongoDB Atlas Vector Search (1024-d, cosine) with a graceful local-JSON fallback.
- **Deployed on Alibaba Cloud** — the backend runs on an Alibaba Cloud Simple Application Server (Docker image), satisfying the proof-of-deployment requirement, and the infrastructure it provisions lands on Alibaba Cloud too.

The app is containerized (`Dockerfile.backend`, with Terraform pre-installed) and hosts on Alibaba Cloud.

## Challenges we ran into

**Two vector spaces, silently.** Earlier code embedded skills with one model in one path and a different model in another, then compared the results. Cosine similarity between vectors from different models is meaningless — retrieval had been quietly degraded. Converging on a single `text-embedding-v4` embedder fixed it, and forced the honest no-fallback design above.

**A stale absolute path.** The learned-skill index stored an absolute path into a *different* repo directory, so every retrieval returned an empty skill body — the loop was "learning" and then reading nothing back. Resolving content from the slug instead of a stored path fixed it.

**Making the deploy target the sponsor's cloud.** Rather than merely *hosting* on Alibaba Cloud, we made the app *generate and apply* `alicloud` Terraform, so Qwen builds real Alibaba Cloud infrastructure end to end.

## Accomplishments we're proud of

- **The loop closes autonomously.** Failure → Qwen repair → auto-authored skill → embedded → vector-retrieved to pre-empt recurrence, with no human editing skills.
- **Qwen in four roles.** Reasoning, vision, embeddings, and speech — one provider, one key.
- **Sponsor platform end to end.** Qwen builds `alicloud` Terraform, applies it to Alibaba Cloud, and the app itself runs on Alibaba Cloud.
- **Two real retrieval bugs found and fixed** — in the exact path the product premise rests on.

## What we learned

Fallbacks are not free. A silent embedding fallback is worse than an honest hard failure, because it corrupts the index instead of returning fewer results.

And an OpenAI-compatible wire format is a superpower: Qwen Cloud exposes the same `/v1/chat/completions` and `/v1/embeddings` as any OpenAI-compatible endpoint, so one client covers every capability and the whole app moved onto Qwen with a base-URL and model-name change.

## What's next for Sky Launchpad

- **Cross-project skill transfer** — a shared skill library, so one team's 2am lesson pre-empts another team's failure.
- **Autonomous UI QA on `qwen3.7-plus`** — Qwen3-VL is grounded for pixel-level GUI control, so the operator-driven self-test can become a fully autonomous screenshot → click/type driver.
- **CosyVoice narration** — server-side TTS of the self-improvement loop via `cosyvoice-v3-plus`.

## Product / market potential

Terraform failures are expensive, repetitive, and organizationally forgotten. Cloud teams re-solve the same class of error across projects because the knowledge lives in individual engineers' heads and stale wiki pages.

Sky Launchpad turns each failure into a durable, machine-readable asset that makes the next deploy cheaper. The value compounds with usage, and the knowledge base is owned by the customer (plain `SKILL.md` files in their own repo).

## Built with

- **Qwen Cloud** (Alibaba Cloud Model Studio) — `qwen3.7-max`, `qwen3.7-plus`, `text-embedding-v4`, `qwen3-asr-flash`
- **Alibaba Cloud** — deploy target (`alicloud` Terraform: OSS, VPC, VSwitch) and app hosting (Simple Application Server / ECS)
- **MongoDB Atlas Vector Search** — skill retrieval (1024-d, cosine)
- **Terraform** CLI (BUSL-1.1 — invoked, not redistributed; [OpenTofu](https://opentofu.org) drops in), **GitLab REST API** — real deploys, real merge requests
- **FastAPI** + **Python**, **React 18** + **TypeScript** + **Vite**
- **Docker** — containerized backend for Alibaba Cloud

## Media

<!-- Replace these placeholders with actual screenshots and links -->

### Screenshots

`[Screenshot: Alibaba Cloud Workbench Overview showing the backend instance running — proof of deployment]`

`[Screenshot: a deploy failing, qwen3.7-max diagnosing, and skills/learned/alicloud-supported-instance-type/SKILL.md appearing]`

`[Screenshot: the same requirement re-run — the learned skill is retrieved and the failure never occurs]`

`[Screenshot: learned-skills dashboard with hit_count and the error -> solution table]`

### Demo

`[Demo video link (< 3 min): fail once, learn, never fail again — deploying to Alibaba Cloud]`

## Links

- **Repository**: <!-- Add your public repo URL here -->
- **Submitted to**: Global AI Hackathon with Qwen Cloud — Track 4: Autopilot Agent

## Created by

- **Eimis**
