# Sky Launchpad — Hackathon Compliance Report

**Event:** 2026 AI Engineer World's Fair Hackathon
**Project:** Sky Launchpad (self-improving cloud-infrastructure agent)
**Date:** 2026-06-27

This report assesses Sky Launchpad against the official hackathon requirements and flags what still needs to be done to be fully compliant and competitive.

---

## 1. Required Theme — ✅ MET

Every project must build in one of three themes. Sky Launchpad squarely fits **Continual Learning** (primary), with a secondary footprint in **The Self-Improvement Stack**.

| Theme | Fit | Evidence in code |
|---|---|---|
| **Continual Learning** | ✅ **Primary** | On a failed deploy, an agent reads logs, fixes the IaC, and **authors a new reusable skill** that is persisted and **retrieved on future deploys** so the same failure is pre-empted — improving with use, no human editing skills. `deployer/antigravity_client.py`, `deployer/skill_library.py`, `deployer/log_collector.py`, `skills/learned/`, `skills_loader.load_learned_skills()`. |
| **The Self-Improvement Stack** | ◑ Secondary | Learned-skill metrics surface at `GET /api/skills/learned`; the loop is an automated evaluate→fix→persist pipeline around real deployments. |
| Recursive Intelligence | ✗ | No raw-weight/model self-modification. |

**Verdict:** Theme requirement satisfied. Pitch as **Continual Learning**.

---

## 2. Special Prize — Gemini 3.5 ($5,000) — ✅ STRONG, with caveats

> Requires at least one bleeding-edge Gemini feature (bonus for combining several); wants something "unprecedented," not a wrapper chatbot.

| Required tech | Used? | Where |
|---|---|---|
| **Managed Agents (Interactions API / Antigravity)** | ✅ Yes | `deployer/antigravity_client.py` — single-call hosted `antigravity-preview-05-2026`, stateful `env_id` across retries, persona/skills via `AGENTS.md`/`SKILL.md`, direct Gemini fallback. |
| **Gemini Live API** | ✅ Yes | `project/backend/gemini_live.py` (real-time narration) + voice transcription (`/api/voice/transcribe`), model `gemini-3.1-flash-live-preview`. |
| **Gemini multimodal image analysis** | ✅ Yes | `project/backend/gemini_client.py` + `image_analysis_agent.py`, model `gemini-3.1-pro-preview`. |
| Computer Use (3.5 Flash) | ✗ Not yet | Candidate stretch: have the repair agent *visually* read the cloud console. |
| Nano Banana / Veo / Lyria / Gemma | ✗ Not yet | Optional bonus. |

**We combine 3 Gemini surfaces** (Antigravity + Live + multimodal), which the brief explicitly rewards. The "unprecedented" angle — *an agent that learns from real cloud failures and narrates its own self-improvement live* — is a genuine fit, not a wrapper chatbot.

**Caveat (must verify before judging):** `antigravity-preview-05-2026`, `gemini-3.1-pro-preview`, and `gemini-3.1-flash-live-preview` are **preview model IDs**. Confirm your API key has access; otherwise the documented fallbacks engage. Set `GEMINI_API_KEY` (and `MINIMAX_API_KEY`) in `project/.env`.

### Other special prizes
- **Best DigitalOcean:** ✗ — app targets **GCP Cloud Run**. Not eligible unless redeployed to DigitalOcean.
- **Best LiveKit:** ✗ — voice uses Gemini Live, not LiveKit. Not eligible as-is.

---

## 3. Other AI provider

- **MiniMax** (`MiniMax-M2`) now powers cloud-architecture JSON generation (`backend/minimax_client.py`, `architecture_agent.py`), replacing Anthropic. This is additive and does not affect theme/prize eligibility.

---

## 4. Hackathon Rules — ⚠️ ACTION REQUIRED

| Rule | Status | Action needed |
|---|---|---|
| **Open source / public repo** | ⚠️ | Repo is local only. **Create a public repository and push** before submission. |
| **Team size ≤ 4** | ✅ | N/A (confirm your team). |
| **New Work Only** | ⚠️ **Critical** | Sky Launchpad is adapted from a prior project (Skyrchitect). The README's "🆕 Hackathon build" section delimits new work, but you **must clearly demo only what was built at the event** (the self-improving loop + Gemini/MiniMax swaps). Pre-existing scaffolding = architecture→Terraform→GitLab pipeline. Failure to distinguish = **immediate disqualification**. |
| **Demo shows only what you built** | ⚠️ | Script the demo around: deploy fails → agent learns → skill authored → next deploy pre-empted → live narration. Call out scaffolding explicitly. |

---

## 5. Banned-Project Check — ✅ CLEAR (with cautions)

| Banned category | Risk | Note |
|---|---|---|
| Basic RAG application | ✅ Clear | Skill retrieval is a small internal mechanism, not the product. |
| Streamlit app | ✅ Clear | React + FastAPI. |
| **Image analyzer** | ⚠️ Caution | Diagram→architecture image analysis exists but is **a secondary feature, not the main point**. Keep the self-improving loop as the headline so this isn't read as "an image analyzer." |
| **Dashboard as main feature** | ⚠️ Caution | The learned-skills panel/metrics must stay secondary — do not lead the demo with a dashboard. |
| Mental health / medical / nutrition / personality / job screener / sports | ✅ Clear | Not applicable. |

---

## 6. Compliance Scorecard

| Area | Score | Summary |
|---|---|---|
| Required theme | ✅ Met | Continual Learning |
| Gemini $5k tech | ✅ Strong | 3 Gemini surfaces combined; verify preview access |
| "Unprecedented" bar | ✅ Likely | Self-learning + live narration, not a wrapper |
| New Work Only | ⚠️ Action | Must delineate hackathon work in demo + repo |
| Public repo | ⚠️ Action | Create + push public repo |
| Banned projects | ✅ Clear | Keep loop (not image/dashboard) as headline |
| DigitalOcean / LiveKit prizes | ✗ N/A | Not targeted |

---

## 7. Punch List to be fully compliant & demo-ready

1. **Set keys** in `project/.env`: `MINIMAX_API_KEY`, `GEMINI_API_KEY` (servers start without them, but calls fail).
2. **Verify preview model access** for the three Gemini IDs; otherwise document the fallback in the demo.
3. **Push a public repo** and confirm license/visibility.
4. **Demo script** that foregrounds the self-improving loop and explicitly separates new work from scaffolding.
5. *(Bonus points)* Add **Computer Use** (visual cloud-console diagnosis) or **Nano Banana** (generate the architecture diagram) to deepen the Gemini story.
6. *(If chasing those prizes)* port voice to **LiveKit** and/or deploy to **DigitalOcean**.
