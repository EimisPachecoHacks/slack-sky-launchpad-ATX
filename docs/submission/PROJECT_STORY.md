# Sky Launchpad

*Global AI Hackathon Series with Qwen Cloud — Track 4: Autopilot Agent*

## Inspiration

It takes more than a decade to become a solutions architect, and most architects
only ever master one cloud. You have to know hundreds of services, estimate costs,
plan for scale, and defend the system against security mistakes. Big companies
hire whole DevOps teams for this. A startup or a 50-person shop can't — so they
guess, overpay, or get stuck.

But the thing that really bothered me was watching AI infrastructure tools make
the *same mistake twice*. I'd ask an assistant to generate Terraform, it would
pick an instance type that isn't offered in the target zone, `terraform apply`
would fail, it would patch it, and we'd move on. Next week, different project,
same class of mistake. The model never got worse — but it never got *better*
either. Every deploy started from zero.

That's not how engineers work. When an SRE hits a wall at 2am, they write it down.
The runbook grows. The team gets faster. I wanted infrastructure automation that
*compounds* — not a bigger model, but an **agent with memory** — and I wanted it
to live where teams already make these decisions: in Slack.

## What it does

Sky Launchpad turns plain English (or an uploaded architecture diagram) into
**deployed cloud infrastructure**, and learns from its own failures along the way.

Inside Slack I type something like *"an online store with a product catalog, image
storage, and a database."* In seconds Qwen designs the full architecture — every
component, a realistic monthly cost, and a diagram — right in the channel. I can
flip between **Cost Optimized** and **Performance Optimized** to see the tradeoffs
instantly, or swap any single component for a cheaper or faster one. One click
writes production-ready **Terraform**. Another click **deploys it for real to
Alibaba Cloud**, and opens a **GitLab merge request** when the infrastructure
actually stands up.

The interesting part is what happens when a deploy **fails**:

1. It reads the Terraform and cloud error logs.
2. **It researches the exact error on the live web** — turning on Qwen's web
   search to check the provider's *current* docs — on the **very first failure**,
   not as a last resort.
3. **Qwen (`qwen3.7-max`)** then diagnoses the root cause with that research in
   hand, fixes the HCL, and authors a generalized, reusable `SKILL.md` — not "fix
   line 42", but "check the VPC CIDR before creating the VSwitch" — and retries.
   The cycle repeats on **every** failure until it succeeds — **fail → research →
   learn → retry → succeed.**
4. Every learned skill is embedded and remembered, so the *next* deploy retrieves
   it by similarity and never repeats the mistake.

Then it can **test the deployed app like a human**. The **Testing agent**
(`qwen3.7-max`) writes its *own* test cases from scratch — for each one it invents
a title, the exact click-by-click **steps**, and the **expected** outcome, guided
by the pitfalls it learned on earlier runs. It then drives a **real browser**
through each case (reading the page's interactive elements so its clicks always
land) and, for every case, reports a clear verdict:

- **✅ pass** — the expected outcome was confirmed, or
- **🐛 fail** — a bug. And when it fails it tells you *three* things: **why**
  (the exact evidence it saw on the page), a **🔧 suggested fix** (one concrete
  sentence for the developer — which validation or handler to add), and a
  **screenshot** of the moment. Each bug is also distilled into a **reusable
  skill**, so the next run already knows to check for that class of problem.

In one real run against a demo app it authored its own cases and caught **two
genuine bugs**: a signup form that accepted empty required fields (fix: *"collect
and display all validation errors at once"*), and a delete button that removed the
**wrong** item (fix: *"the handler must remove the specific todo from state"*) —
each with the evidence, the fix, and a screenshot.

## Two ways in, one brain

Everything above works in **two interchangeable interfaces — Slack and a React web
app — on one shared backend**. They are the *same product with different surfaces*:

- **Slack** is where a team designs, deploys, and reviews **together in a channel**
  — Block Kit cards for the architecture, cost/performance tabs, component swaps,
  the deploy, and the test results.
- The **web app** is the same flow with a **visual architecture canvas**, plus a
  live **"How It Learned"** view of the skill memory and a **"UI Self-Test"** page.

Because both talk to the **same FastAPI backend**, the behavior is identical — you
can start a design in the web app and finish it in Slack, or run **both at the same
time, side by side**. Same brain, different UI.

It's a team of **five specialized agents**, each powered by Qwen: an
**Architecture** agent that designs the system, a **Vision** agent that reads
uploaded diagrams, a **Code** agent that writes Terraform, a **Repair** agent that
heals its own failures, and a **Testing** agent that drives the live app.

## How I built it

**Qwen Cloud is load-bearing across five capabilities**, not one call bolted onto
a template engine — all through the OpenAI-compatible DashScope endpoint:

| Capability | Model / feature |
|---|---|
| Architecture design, Terraform generation, failure repair | `qwen3.7-max` |
| Diagram image → structured architecture (vision) | `qwen3.7-plus` |
| Self-improving memory (skill embeddings) | `text-embedding-v4` |
| Voice input | `qwen3-asr-flash` |
| Live web research on every failure (from the first) | Qwen web search (`enable_search`) |

The backend is FastAPI, containerized with Docker, and **runs on Alibaba Cloud
ECS** — provisioned by Terraform (`infra/alibaba/backend/main.tf`) into a VPC,
VSwitch, and security group. The infrastructure the app *generates* also targets
Alibaba Cloud: `deployer/iac_generator.py` emits `alicloud` Terraform that
`terraform apply` runs for real. The self-improving skill library persists every
lesson as a versioned `SKILL.md` plus a vector in **PostgreSQL + pgvector running
on Alibaba Cloud**, so skill retrieval is native cosine KNN over the Qwen
embeddings. The Slack app
is Bolt for JavaScript (Socket Mode, Block Kit); the web app is React + Vite. The
browser-testing agent is built on Playwright, grounded in the page's accessibility
tree so its clicks always land.

## Challenges I ran into

- **Making the loop actually *learn*, not just patch.** The self-healing loop
  first lived only in a CLI. I had to wire skill-authoring into the same HTTP
  deploy path the product calls, so the differentiator fires for real users.
- **The backend dying under its own deploy.** A five-minute `terraform apply`
  spiked memory and the single uvicorn worker got OOM-killed — nginx stayed up,
  so the API *looked* alive but every request timed out. I added a respawn
  supervisor, swap, and multiple workers so a slow deploy can't starve the fast
  endpoints.
- **Reliable browser testing.** My first tester decided clicks from screenshot
  pixels and constantly missed by tens of pixels. I rebuilt it to read the DOM's
  interactive elements and act by index — same "acts like a human" behavior, but
  clicks that always land.
- **Forcing the failure story to be honest.** To demonstrate the recursive arc I
  built a two-stage fault: one error Terraform catches at plan time, and one the
  Alibaba API only rejects at apply time — so a single fix isn't enough, and the
  agent has to research, learn, and retry across *two* real failures before it
  succeeds.
- **Getting the illustrated diagram to actually appear** in Slack (it was being
  buried in a collapsed thread reply, and the image format didn't match its
  filename).

## Accomplishments that I'm proud of

- **The full recursive arc, working end-to-end on real Alibaba Cloud
  infrastructure**: a deploy that fails, researches the error on the live web,
  learns a skill and retries, fails again on a second fault, researches and
  updates the skill, and *succeeds* on the third attempt — then opens a GitLab
  MR. Not a mock; a real `terraform apply`.
- **A browser-testing agent that finds real bugs** — empty-field validation and a
  wrong-item delete — and screenshots the evidence, all decided by Qwen.
- **Qwen doing five different jobs** through one endpoint, including live web search on every repair.
- **A backend genuinely running on Alibaba Cloud** that anyone can verify with a
  single unauthenticated `curl`.
- Proving every flow by driving the *real* Slack and web UIs and capturing the
  screenshots — no faked demos.

## What I learned

- Qwen Cloud's OpenAI compatibility made a genuinely multi-capability agent
  simple: text, vision, embeddings, ASR, and web search behind one client and one
  key.
- A self-improving system only matters if the learning lives on the path users
  actually take — the loop has to fire in the product, not in a script.
- Grounding beats raw vision for reliability: reading the DOM made the testing
  agent trustworthy where pixel-guessing never was.
- "It works" isn't a claim you make from unit tests — you make it by driving the
  real interface and watching it happen. Half of what I fixed only showed up when
  I stopped mocking and drove the live app.

## What's next for Sky Launchpad

- **Broader cloud coverage** — the generator already emits AWS/GCP/Azure Terraform;
  bringing the self-healing loop to full parity across all four.
- **A shared, growing knowledge base** — learned skills that transfer across
  teams and projects, so the memory compounds organization-wide.
- **More autonomy with the right guardrails** — approving a real deploy should
  stay human, but drift detection, cost alerts, and auto-remediation shouldn't.
- **Polishing the web app's deploy path** to full parity with Slack, and richer
  live narration of the repair loop.

Sky Launchpad is not a chatbot that answers questions. It is a team of autonomous
agents that **think, deploy, test, and improve** — powered end to end by Qwen on
Qwen Cloud, and running on Alibaba Cloud. Professional cloud architecture for
everyone.
