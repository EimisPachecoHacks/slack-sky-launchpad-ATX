# Sky Launchpad — 3-Minute Demo Script

*(~440 words · ~2:55 at a natural pace. The old AWS/SageMaker script is
replaced — this matches what we actually built: Nemotron on self-hosted vLLM,
inside Slack, with real deploys, self-improvement, and NemoClaw containment.)*

---

**[Hook — 0:00]**
Designing cloud infrastructure is hard. You need to know hundreds of services,
estimate costs, plan for scale, and not get hacked. Big companies hire cloud
architects and DevOps teams. Small and mid-size companies can't afford that —
so they guess, overpay, or stall. **Sky Launchpad fixes that. And it lives right
where your team already works: Slack.**

**[The flow — 0:25]**
Watch. In Slack I just type: *"an online store with a product catalog, image
storage, and a database."* In seconds, Sky Launchpad designs the full
architecture — every component, a real cost estimate, and a diagram — right in
the channel. I can flip between **Cost-Optimized** and **Performance-Optimized**
to see the trade-offs instantly, or swap any single component for a cheaper or
faster alternative. One click and it writes production **Terraform**. Another,
and it **deploys it for real** to the cloud. Then it **tests the live app like a
human** — clicking through it, catching bugs.

**[The technology — the sponsor tech — 1:15]**
Here's what powers it. The brain is **NVIDIA Nemotron** — it does everything:
the architecture reasoning, the Terraform, reading a diagram you upload, and
diagnosing failures. And we run Nemotron **on our own vLLM server** — open
NVIDIA models on hardware we control, not a hosted frontier API. It's a small
Mixture-of-Experts model doing an entire DevOps team's job — the small-model
punch.

Because this agent holds **real cloud credentials and runs real Terraform**, we
contain it with **NVIDIA NemoClaw and OpenShell**. The agent works freely inside
a sandbox, but the OpenShell policy blocks it from exfiltrating your credentials
or touching anything off its allow-list — we proved it live: it reaches its
Nemotron brain, but every attempt to phone home to an attacker is refused.

And it gets **smarter every run**: every deployment failure is diagnosed,
distilled into a skill, and remembered — so the next deploy pre-empts the
mistake. Dumb on attempt one, sharp by the end. No retraining.

**[Why it matters — commercial — 2:15]**
For a startup or a 50-person company, this replaces a cloud architect they can't
hire. Design, cost-optimize, deploy, and test — in the tool they already open
every morning. We chose **Slack** because infrastructure decisions are a team
conversation, not a solo dashboard: everyone sees the design, the cost, the
diagram, and can weigh in. No new tool to learn.

**[Close — 2:40]**
Sky Launchpad isn't a chatbot that answers questions. It's an autonomous agent
that **thinks, deploys, tests, and improves** — powered end-to-end by NVIDIA
Nemotron, served on vLLM, and safely contained by NemoClaw. Professional cloud
architecture, for everyone. **That's Sky Launchpad.**
