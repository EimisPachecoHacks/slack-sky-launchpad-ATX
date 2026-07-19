# Sky Launchpad — 3-Minute Demo Script

**Global AI Hackathon Series with Qwen Cloud — Track 4: Autopilot Agent**

*(Matches what we built: a team of Qwen-powered agents inside Slack that design,
deploy, test, and learn — with the backend running on Alibaba Cloud.)*

---

Designing cloud infrastructure is hard. It takes more than a decade to become a
solutions architect, and most architects specialize in only one cloud. You need
to understand hundreds of services, estimate costs, plan for scale, and protect
the system from security threats. Large companies hire cloud architects and
DevOps teams. Small and mid-size companies cannot afford that, so they guess,
overpay, or get stuck. Sky Launchpad fixes that. And it lives right where your
team already works: Slack.

Watch. In Slack, I simply type: an online store with a product catalog, image
storage, and a database. In seconds, Sky Launchpad designs the full architecture
— every component, a realistic cost estimate, and a diagram, all directly in the
channel. I can switch between **Cost Optimized** and **Performance Optimized** to
see the tradeoffs instantly, or replace any single component with a cheaper or
faster alternative. With one click it writes production-ready **Terraform**. With
another click it **deploys that infrastructure for real to Alibaba Cloud**. Then
it **tests the live application like a human**, clicking through it and catching
bugs.

This is Track 4 — **Autopilot Agent** — because the whole workflow runs
end-to-end: **design → generate Terraform → deploy → validate → commit → learn.**
The only human checkpoint is the one that should be human: approving a real,
billable deploy.

It isn't one model doing all this — it's a **team of five specialized agents**,
each powered by Qwen: an **Architecture agent** that designs the system, a
**Vision agent** that reads diagrams you upload, a **Code agent** that writes the
Terraform, a **Repair agent** that deploys and heals its own failures, and a
**Testing agent** that drives the live app like a real user.

Here is what powers them, and we use **Qwen Cloud for every part**. Architecture
design, Terraform generation, and failure repair run on **`qwen3.7-max`**.
Reading the diagrams you upload and driving the browser to test the app run on
**`qwen3.7-plus`**, Qwen's vision model. The self-improving memory — how it
remembers past failures — is powered by **`text-embedding-v4`**, and voice input
uses **`qwen3-asr-flash`**. Every model is called through one OpenAI-compatible
Qwen Cloud endpoint, so a single API key and a model name drive every capability.

And the backend itself **runs on Alibaba Cloud** — a Docker container on an ECS
instance we provisioned with Terraform, in `ap-southeast-1`. The agent that
deploys infrastructure to Alibaba Cloud is itself hosted on Alibaba Cloud.

It also gets **smarter with every run**. Each deployment failure is diagnosed by
`qwen3.7-max`, converted into a reusable `SKILL.md`, embedded with
`text-embedding-v4`, and remembered — so the next deployment retrieves that
lesson by vector similarity and prevents the same mistake. It may be
inexperienced on the first attempt, but it becomes sharper with every run,
without retraining. No human ever edits a skill.

For a startup or a 50-person company, this replaces a cloud architect they cannot
afford to hire. It can design, optimize costs, deploy, and test — all inside the
tool the team already opens every morning. We chose **Slack** because
infrastructure decisions are team conversations, not tasks that should happen
inside a private dashboard. Everyone sees the design, the cost, and the diagram,
and everyone can contribute. There is no new tool to learn.

Sky Launchpad is not a chatbot that answers questions. It is a team of autonomous
agents that **think, deploy, test, and improve** — powered end to end by Qwen on
Qwen Cloud, and running on Alibaba Cloud. Professional cloud architecture for
everyone. **That is Sky Launchpad.**

---

## Exact demo inputs

| Step | What to type / click |
|---|---|
| Start | `/sky new` in `#general` (or `@Sky Launchpad` → **Guided Wizard**) |
| Provider | **Alibaba Cloud** |
| Title | `Online store` |
| Description | `An online store with a product catalog, image storage, and a database.` |
| Then | **Generate Architecture** → wait ~60–90s (`qwen3.7-max`) |
| Show | Component table, **Cost/Performance** tabs, per-component **Switch** dropdown, in-channel architecture diagram |
| Then | **Generate Code** → Terraform → **🚀 Deploy** |
| Finish | Deploy result + learned-skill message |

## What to have on screen before recording

1. Backend health on Alibaba Cloud (see `docs/ALIBABA_DEPLOYMENT_PROOF.md` for the current IP)
2. The Alibaba Cloud console **Workbench / instance overview** (proof screenshot)
3. Slack open on `#general`
