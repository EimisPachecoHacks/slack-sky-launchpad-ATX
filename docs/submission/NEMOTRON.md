# Best Use of Nemotron — Sky Launchpad

**What Nemotron does in our agent, why it matters, and how we maximize it.**

## Nemotron is the only brain

Sky Launchpad is an autonomous cloud-infrastructure agent: describe a project in
Slack → it designs the architecture, generates Terraform, deploys it for real,
then tests the deployed app like a human. Every reasoning step runs on the
**NVIDIA Nemotron** family — nothing else:

| Agent capability | Nemotron model | Where |
|---|---|---|
| Architecture reasoning (NL → components, connections, costs as structured JSON) | **Nemotron 3 Nano 30B-A3B** | self-hosted vLLM |
| Terraform / CloudFormation generation | Nemotron 3 Nano 30B-A3B | self-hosted vLLM |
| Failure diagnosis in the self-healing deploy loop | Nemotron 3 Nano 30B-A3B | self-hosted vLLM |
| Cost/performance optimization options per component | Nemotron 3 Nano 30B-A3B | self-hosted vLLM |
| Diagram vision (uploaded image → architecture) & UI-test agent (screenshot → click) | **Nemotron Nano VL 8B** | NVIDIA NIM |
| Skill-retrieval embeddings (1024-d) for the learning memory | **llama-nemotron-embed-1b-v2** | NVIDIA NIM |

There is no fallback to a frontier API. If Nemotron is unreachable, the agent
degrades (lexical skill search) rather than switching models.

## Why it matters

The whole product is a *reasoning-heavy, long-running* agent — it plans,
writes IaC, reads error logs, and repairs itself over multiple deploy attempts.
That is exactly the agentic workload Nemotron is built for, and it's the
opposite of a chatbot wrapper: the model's output *is* the infrastructure that
gets applied to a real cloud account.

## How we maximize Nemotron's capabilities

- **The MoE small-model punch.** Nemotron 3 Nano 30B-A3B activates only ~3.5B
  parameters per token, so a single A100 serves the entire agent — reasoning,
  code, and the repeated diagnosis calls — at frontier-adjacent quality. We
  deliberately did *not* reach for the biggest model that fits.
- **Reasoning-model handling.** Nemotron emits `<think>` traces; our client
  strips them and we floor generation at 12k tokens so structured JSON never
  truncates mid-reasoning (a real bug we hit and fixed).
- **Structured output + tool use.** Architecture design and the optimization
  advisor demand strict JSON; we prompt for exact schemas and parse defensively.
- **Grounding + a feedback loop that improves output over time.** Every deploy
  failure is diagnosed by Nemotron, distilled into a `SKILL.md`, embedded with
  the Nemotron embedder, and retrieved on the next run to pre-empt the same
  error — so Nemotron's *effective* output quality rises run over run
  (see the Recursive Intelligence write-up).
- **Vision doing real work.** The UI-test agent screenshots a live app and asks
  Nemotron Nano VL where to click — visual grounding, not captioning.

## Differentiation

It's not "Nemotron answers questions." Nemotron **operates real cloud
infrastructure** end-to-end and **gets better at it every run**, entirely on
open NVIDIA models running on our own hardware.
