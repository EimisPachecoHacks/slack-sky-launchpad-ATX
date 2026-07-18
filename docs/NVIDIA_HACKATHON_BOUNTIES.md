# NVIDIA Hackathon — Track & Bounty Rules (verbatim reference)

> Saved 2026-07-18 from the organizer's text, so we can check qualification while
> building. Strategy that targets these lives in `NVIDIA_BACKEND_PLAN.md`.
> Our entry: Sky Launchpad NVIDIA backend (Slack UI) — Recursive Intelligence
> track + all three bounties below via one GPU box (vLLM serving Nemotron,
> agent contained by NemoClaw/OpenShell).

---

## Recursive Intelligence Track

**The challenge:** Build an agent that measurably gets smarter the more it runs. Not a static agent with good prompts—a system that captures what it learns, compounds it into a persistent knowledge base or knowledge graph, and demonstrably improves at its task over successive runs. The classic sci-fi arc: dumb at first, sharp by the end, without retraining a model.

**What "good" looks like:** An agent that speed-runs a task it fumbled on attempt one; a research agent whose outputs sharpen each cycle as it scrapes and updates its own knowledge base; a logistics or ops agent that makes better decisions as its context library grows.

**How it's judged:** Demonstrated improvement over time on a defined task—performance delta between first run and last run (completion time, accuracy, decision quality). Bonus credit for a clear learning mechanism (knowledge graph, RAG-from-self-context, compressed episodic memory).

**→ Our answer:** the self-improving skills library (failure → diagnosis → SKILL.md → embedding → retrieval on next run); delta metric = `total_retries_avoided` + run duration, first-run-vs-last-run demo.

---

## Best Use of vLLM — $500 Cash

**Applies to:** Any track (cross-cutting; stacks on track placement).

**The challenge:** Incorporate **vLLM** into your build. vLLM is the open-source, high-throughput inference and serving engine for LLMs—stand up your own OpenAI-compatible endpoint, serve an open model (Nemotron, Llama, Mistral, Qwen, etc.), and route your agent's inference through it. The point: prove you can run a capable long-running agent on self-hosted open infrastructure instead of leaning entirely on a hosted frontier API.

**To qualify:** Your agent's inference has to actually run on vLLM. Minimum bar is a functional vLLM-served endpoint doing real work in your build—not a token mention. Any track, any theme, any model, as long as vLLM is genuinely in the loop.

**What wins:** Judges will weight—
- **Efficiency** — smart use of vLLM's strengths (continuous/in-flight batching, PagedAttention, concurrent request handling); most capability per unit of compute.
- **The small-model punch** — getting outsized utility from a small open model + agent scaffolding (the 2B-parameter-model-that-outperforms-its-size pattern) rather than brute-forcing with the biggest thing that fits.
- **Real integration** — vLLM serving something the build genuinely depends on, especially under a heartbeat where concurrent/repeated inference makes throughput matter.

**→ Our answer:** self-hosted vLLM on the GPU box serving Nemotron 3 Nano 30B-A3B (MoE, 3.5B active = small-model punch); the self-healing deploy loop's repeated diagnosis calls are the heartbeat; ALL agent inference routes through it. Managed APIs (NIM cloud, Featherless) do NOT count.

---

## Best Use of NemoClaw + OpenShell — $100 Brev credits per team member

**Applies to:** Any track.

**The challenge:** Build an agent worth containing - then contain it. The hardest part of shipping an autonomous agent isn't making it capable, it's trusting it with real access.

NVIDIA NemoClaw is an open source reference stack for running always-on AI agents (OpenClaw, Hermes, or LangChain Deep Agents Code) more safely inside NVIDIA OpenShell sandboxes. It provides guided onboarding, a hardened blueprint, routed inference, network policy, and lifecycle management through a single CLI.

OpenShell is the safe, private runtime for autonomous AI agents. It provides sandboxed execution environments that protect your data, credentials, and infrastructure - governed by declarative YAML policies that prevent unauthorized file access, data exfiltration, and uncontrolled network activity.

This bounty rewards teams that give an agent genuine power and then hold it inside a boundary that survives contact with an adversary.

Done right it looks like an agent with live credentials and real access (a repo, an account, a data store) that works freely inside the sandbox but is policy-blocked from crossing a line it should never cross: exfiltrating data, reaching an un-approved endpoint, touching a protected path, or firing an irreversible action. It knows how, it has the access, and it still can't, because the boundary lives in the OpenShell policy, not in the agent's goodwill.

**To qualify:** Your build must use both. Stand up your agent with NemoClaw (any supported harness, routed to Nemotron / open models), and author a real OpenShell YAML policy: not a config that never fires, but a constraint judges can test under pressure. Submit a short written explanation covering how your agent maps to the NemoClaw blueprint and how your OpenShell policy enforces a boundary that holds.

**What wins:** Judges will weight:
- **Genuine Capability Underneath:** The more the agent can do, the more the containment is proving something. A weak agent behind a strong policy isn't a story. NemoClaw is how you show the agent was worth containing.
- **Policy Robustness:** Can judges get the agent to cross a line it shouldn't via adversarial prompting or unexpected input? The harder the boundary is to break, the stronger the entry.
- **Non-trivial Policy:** Boundaries that reflect real judgment (allow-with-escalation, conditional permissions, operator approval / human-in-the-loop for edge cases) over a blunt global block.
- **Architectural Clarity:** Can the team show how their agent maps to the NemoClaw blueprint and one design decision it forced? Teams that can narrate their architecture as clearly as they demo their policy will score higher than teams that can only show the output.

**→ Our answer (MANDATORY, not optional):** deployer agent with live Alibaba RAM keys + GitLab token runs inside NemoClaw, routed to our vLLM Nemotron endpoint. OpenShell YAML: allow terraform plan/apply in workspace + allowlisted endpoints (Alibaba API, GitLab, vLLM); block terraform destroy (operator approval = allow-with-escalation), non-allowlisted network (anti-exfiltration), credential reads outside tool path. Adversarial prompt-injection test script included for judges.

---

## Best Use of Nemotron — $100 Brev credits per team member

**Applies to:** Any track.

**The challenge:** Build an agent where the model is doing real work — then prove Nemotron was the right choice to power it. Nemotron is NVIDIA's family of open models built for agentic workloads: fast, capable, and deployable via NIM. The easy path is dropping it in as a chatbot layer and calling it done. This bounty is for teams that go further — where Nemotron is central to what the agent actually does, and the output quality reflects it.

**To qualify:** Your build must use Nemotron as the model powering your agent. Submit a short written explanation covering what Nemotron is doing in your agent, why it matters, and how you're maximizing its capabilities.

**What wins:** Judges will weight:
- **Core model usage:** Nemotron is central to the project's value, not just a thin wrapper. The team can clearly explain what it does and why it matters to the agent's function.
- **Technical execution:** the demo works reliably, and the team shows strong implementation choices around architecture, API use, data flow, tool use, latency, or error handling.
- **Quality of AI output:** Nemotron produces useful, relevant, and trustworthy outputs. The team has actively worked to improve output quality through prompt design, grounding, evaluation, or feedback loops.
- **Impact and usefulness:** the agent solves a real problem for a clear audience, and the solution has potential beyond the hackathon.
- **Creativity and differentiation:** the team uses Nemotron in a thoughtful or novel way. The project feels distinct from generic AI demos and shows original thinking.

**→ Our answer:** Nemotron is the ONLY brain of the NVIDIA backend — architecture reasoning, Terraform/CloudFormation generation, failure diagnosis, diagram vision (12B v2 VL), and skill embeddings (embed-1b-v2). "Maximizing capabilities" evidence: reasoning-budget control on the heartbeat loop, tool-calling/structured JSON, skills-library feedback loop improving output quality run over run.

---

## Submission checklist (all four)

- [ ] Track: first-run vs last-run delta demo + metrics report
- [ ] vLLM: endpoint live during demo, all inference routed through it, efficiency write-up
- [ ] NemoClaw/OpenShell: working sandbox + YAML policy + adversarial test + written explanation
- [ ] Nemotron: written explanation (what/why/how maximized)
- [ ] Architecture diagram covering all of the above
