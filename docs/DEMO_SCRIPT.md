# Demo Video Script (≤ 3 Minutes)

For the Global AI Hackathon with Qwen Cloud — **Track 4: Autopilot Agent**.

The through-line is the money demo: **fail once, learn, never fail again** — on Alibaba Cloud, powered by Qwen.

## Setup before recording

1. Backend running (locally or on the Alibaba Cloud instance) with `DASHSCOPE_API_KEY` set.
2. Alibaba Cloud RAM AccessKey uploaded in **Settings → Alibaba Cloud**.
3. A MongoDB Atlas vector index on `skills` (1024-d, cosine) — or the local fallback.
4. The **Alibaba Cloud Workbench Overview** open in a tab (proof of deployment).
5. Clean browser profile, 1920×1080, zoom ~125%.

---

## Script

### 0:00 – 0:20 | The problem

> "Every infrastructure tool makes the same mistake twice. An AI generates Terraform, it fails on some cloud-specific rule, you fix it — and next week, a different project, it makes the *same* mistake. The model never gets better. We built an autopilot agent that does: it remembers every failure."

*Show: the Sky Launchpad home screen.*

### 0:20 – 0:50 | Describe → design (Qwen)

> "I describe what I need — a web app on Alibaba Cloud with storage, a network, and a database."

*Action: select **Alibaba Cloud**, type the requirement, hit Generate.*

> "`qwen3.7-max` on Qwen Cloud designs the architecture and writes the Terraform. I could also upload a diagram — `qwen3.7-plus` reads it directly."

*Show: the generated architecture + Terraform.*

### 0:50 – 1:40 | Deploy → fail → learn (the loop)

> "Now I deploy for real. This runs `terraform apply` against Alibaba Cloud."

*Action: Deploy. It fails (e.g. an unsupported ECS instance type in the zone).*

> "Watch the narration. The failure goes to `qwen3.7-max`, which diagnoses the root cause, rewrites the HCL, and — this is the key part — **authors a reusable skill**."

*Show: the live narration streaming `failure → diagnose → learned → retry`, and `skills/learned/alicloud-supported-instance-type/SKILL.md` appearing.*

> "The retry succeeds. The infrastructure is up on Alibaba Cloud."

### 1:40 – 2:20 | Never again (transfer)

> "Here's what makes it an *agent with memory*. I run the exact same requirement again."

*Action: re-run the identical requirement.*

> "This time the learned skill is retrieved by vector similarity — embedded with `text-embedding-v4` — and injected before generation. The failure never happens. The system got better from its own experience, with no human editing anything."

*Show: the deploy succeeding on the first try; the learned-skills dashboard with `hit_count` incrementing.*

### 2:20 – 2:50 | Proof of deployment + recap

> "The whole backend runs on Alibaba Cloud."

*Show: the Alibaba Cloud Workbench Overview with the running instance.*

> "So Qwen designs it, Qwen repairs it, Qwen remembers it — and it all deploys to Alibaba Cloud. Reasoning, vision, embeddings, and speech, one provider, one key."

### 2:50 – 3:00 | Close

> "Sky Launchpad — an autopilot agent for infrastructure that learns from its own failures. From idea, to deployed, to *never making that mistake again*."

*Show: the README architecture diagram.*

---

## Recording tips

- If a live deploy is slow, pre-record the failure→repair→retry and narrate over it.
- Keep it under 3 minutes — judges aren't required to watch beyond that.
- Make the "run it again, no failure" moment unmistakable; that's the whole thesis.
