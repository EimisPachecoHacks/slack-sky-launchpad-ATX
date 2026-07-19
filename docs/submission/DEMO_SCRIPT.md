# Sky Launchpad — 3-Minute Demo Script

*(Matches what we built: five specialized Nemotron agents on self-hosted vLLM,
inside Slack, with real deploys, a self-improving loop, and NemoClaw containment.)*

---

Designing cloud infrastructure is hard. It takes more than a decade to become a
solutions architect, and most architects specialize in only one cloud platform.
You need to understand hundreds of services, estimate costs, plan for scale, and
protect the system from security threats. Large companies hire cloud architects
and DevOps teams. Small and mid-size companies cannot afford that, so they guess,
overpay, or get stuck. Sky Launchpad fixes that. And it lives right where your
team already works: Slack.

Watch. In Slack, I simply type: an online store with a product catalog, image
storage, and a database. In seconds, Sky Launchpad designs the full architecture,
including every component, a realistic cost estimate, and a diagram, all directly
in the channel. I can switch between **Cost Optimized** and **Performance
Optimized** to see the tradeoffs instantly, or replace any component with a
cheaper or faster alternative. With one click, it writes production-ready
**Terraform**. With another click, it **deploys the infrastructure directly to
the cloud**. Then it **tests the live application like a human**, clicking
through it and catching bugs.

And it isn't one model doing all this — it's a **team of five specialized AI
agents**, each powered by NVIDIA Nemotron: an **Architecture agent** that designs
the system, a **Vision agent** that reads diagrams you upload, a **Code agent**
that writes the Terraform, a **Repair agent** that deploys and heals its own
failures, and a **Testing agent** that drives the live app like a real user.

Here is what powers them, and we use NVIDIA Nemotron models for every part. The
main brain — architecture design, Terraform generation, and failure repair — is
**NVIDIA Nemotron 3 Nano 30B-A3B**, a small Mixture-of-Experts model that
activates just three-and-a-half billion parameters, doing the work of an entire
DevOps team. Reading the diagrams you upload and driving the browser to test the
app run on **Llama-3.1 Nemotron Nano VL 8B**, NVIDIA's vision model. And the
self-improving memory — how it remembers past failures — is powered by
**Llama Nemotron Embed 1B**. The two Nemotron 3 Nano and Embed models run **on
our own vLLM server**, on hardware we control, instead of a hosted frontier API.
The one thing that isn't Nemotron is the polished diagram picture, drawn by
**Google's Gemini 3 Pro Image** — everything that touches your infrastructure is
NVIDIA Nemotron.

Because these agents hold **real cloud credentials and run real Terraform**, we
contain them using **NVIDIA NemoClaw and OpenShell**. The agent can work freely
inside a sandbox, but the OpenShell policy prevents it from exposing credentials
or accessing anything outside its allow list. We proved this live. It can reach
its Nemotron brain, but every attempt to send information to an attacker is
blocked.

It also gets **smarter with every run**. Each deployment failure is diagnosed,
converted into a reusable skill, and remembered, so the next deployment can
prevent the same mistake. It may be inexperienced on the first attempt, but it
becomes sharper with every run, without retraining.

For a startup or a 50-person company, this replaces a cloud architect they cannot
afford to hire. It can design, optimize costs, deploy, and test, all inside the
tool the team already opens every morning. We chose **Slack** because
infrastructure decisions are team conversations, not tasks that should happen
inside a private dashboard. Everyone can see the design, the cost, and the
diagram, and everyone can contribute. There is no new tool to learn.

Sky Launchpad is not a chatbot that simply answers questions. It is a team of
autonomous agents that **think, deploy, test, and improve**, powered from
beginning to end by NVIDIA Nemotron, served through vLLM, and safely contained by
NemoClaw. Professional cloud architecture for everyone. **That is Sky Launchpad.**
