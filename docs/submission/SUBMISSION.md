# Sky Launchpad — Devpost submission guide & compliance

**Hackathon:** Global AI Hackathon Series with Qwen Cloud · **Track 4 — Autopilot Agent**

This is a fill-in-the-blanks guide for the Devpost form, plus a compliance map
against the requirements and judging criteria.

---

## What to paste into each Devpost field

| Field | What to enter |
|---|---|
| **Project name** | Sky Launchpad |
| **Elevator pitch** | An autopilot agent for cloud infrastructure that designs, deploys, tests, and *learns from its own failures* — powered end-to-end by Qwen on Qwen Cloud, running on Alibaba Cloud, inside Slack. |
| **Track** | Autopilot Agent (Track 4) |
| **Repository URL** | the public GitHub repo (MIT licensed) |
| **Proof of Alibaba Cloud deployment** | Link **`deployer/iac_generator.py`** (generates `alicloud` Terraform — 14 `alicloud_*` resources) and **`infra/alibaba/backend/main.tf`** (provisions the ECS/VPC that hosts the backend). Live proof: `http://47.84.111.187:8080/api/status` → `llm_provider: qwen`, `model_id: qwen3.7-max`. See `docs/ALIBABA_DEPLOYMENT_PROOF.md`. |
| **Architecture diagram** | The mermaid diagram in `README.md` (§ How it works). |
| **Demo video** | 1–3 min, public on YouTube/Vimeo. Script: `docs/submission/DEMO_SCRIPT.md`. |
| **Text description** | `DEVPOST.md` (copy in). |

---

## Requirement compliance

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Public repo + OSS license (detectable) | ✅ | Public repo, MIT `LICENSE` at root |
| 2 | Proof of Alibaba Cloud use (code file) | ✅ | `deployer/iac_generator.py`, `infra/alibaba/backend/main.tf`, `project/backend/llm_client.py` (DashScope), plus the live ECS endpoint |
| 3 | Architecture diagram | ✅ | `README.md` mermaid |
| 4 | Demo video (~3 min, public) | ⬜ | Record + upload (script ready) |
| 5 | Text description | ✅ | `DEVPOST.md`, `README.md` |
| 6 | Track identification | ✅ | Track 4 |

---

## How the project scores on the judging criteria

### Technical Depth & Engineering — 30%  ·  *sophisticated QwenCloud API usage*
Qwen is load-bearing across **five** capabilities, not one call bolted on:

| Capability | Qwen model / feature | Where |
|---|---|---|
| Architecture design + Terraform generation + failure repair | `qwen3.7-max` | `deployer/`, `project/backend/agents/architecture_agent.py` |
| Diagram → structured architecture (vision) | `qwen3.7-plus` | `project/backend/agents/image_analysis_agent.py` |
| Skill retrieval memory (embeddings) | `text-embedding-v4` (1024-d) | `deployer/skill_library.py`, `skydb/` |
| Voice input | `qwen3-asr-flash` | `project/backend/llm_client.py` |
| **Live web research on repeat failure** | Qwen Cloud `enable_search` | `deployer/repair_agent.py` (research escalation) |

- **Custom skills:** every deploy failure is diagnosed by `qwen3.7-max`, turned
  into a reusable `SKILL.md`, embedded, and retrieved by vector similarity to
  pre-empt recurrence — a self-improving skill library (`skills/learned/`).
- **Escalation loop:** if the first authored skill doesn’t hold, the agent turns
  on Qwen web search, researches the exact provider error, and authors an
  *updated* skill — `fail → learn → fail → research → update → succeed`.

### Innovation & AI Creativity — 30%  ·  *architecture, modularity, error handling*
- Five specialized agents (Architecture, Vision, Code, Repair, Testing).
- Self-healing deploy loop with real `terraform apply` against Alibaba Cloud.
- A UI-testing agent that drives a real browser like a user (element-indexed,
  screenshots every step, distills bugs into skills).
- Two front-ends on one backend: a Slack Block Kit app (primary) and a React web app.

### Problem Value & Impact — 25%
Replaces a cloud architect a startup can’t afford to hire: design → cost-optimize
→ deploy → test → learn, inside the tool the team already uses (Slack).

### Presentation & Documentation — 15%
`README.md` (overview + diagram), `DEVPOST.md` (write-up),
`docs/submission/DEMO_SCRIPT.md` (3-min script), `docs/TEST_CASES.md`
(reproducible test plan with screenshots), `docs/ALIBABA_DEPLOYMENT_PROOF.md`.

---

## Your remaining 3 steps

1. **Workbench screenshot** (strengthens requirement #2): Alibaba Console → ECS →
   region `ap-southeast-1` → instance `sky-launchpad-hackathon` (Running).
2. **Record the demo** (1–3 min) using `docs/submission/DEMO_SCRIPT.md`.
3. **Submit on Devpost** with the fields above.

## After judging
- Tear down billing: `CONFIRM_ALIBABA_DESTROY=yes ./scripts/destroy-alibaba-backend.sh`.
- Rotate the Alibaba AccessKey (it lives encrypted on the ECS box) and the GitHub token.
