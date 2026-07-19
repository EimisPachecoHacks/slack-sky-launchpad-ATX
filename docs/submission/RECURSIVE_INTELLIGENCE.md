# Recursive Intelligence Track — Sky Launchpad

**An agent that measurably gets better at deploying and testing infrastructure
the more it runs — no model retraining.**

## The learning mechanism

Sky Launchpad has a persistent, self-authored memory. The loop:

1. **Attempt** — the agent deploys (real `terraform apply`) or tests a deployed app.
2. **Fail** — a step errors (e.g. `InvalidInstanceType`, a validation gap in a UI).
3. **Diagnose** — Nemotron reads the error/log and writes the root cause + fix.
4. **Learn** — the fix is distilled into a `SKILL.md`, embedded with the
   Nemotron embedder (llama-nemotron-embed-1b-v2, 1024-d), and stored in
   **Supabase pgvector** (the NVIDIA backend's memory).
5. **Retrieve** — on the *next* run, the agent embeds the new task and pulls the
   most similar past skills, injecting them as context so it pre-empts failures
   it has seen before.

This is RAG-from-self-context + episodic memory, not a static prompt. The memory
is queryable (`match_learned_skills` HNSW cosine) and grows with every run.

## The demonstrated delta (first run vs last run)

The judging metric is the performance gap between the first and last run on a
defined task. We measure it with `nvidia/backend/metrics/delta_report.py`, which
reads the live skills store and deploy timeline:

- **Skills learned** and **times each was reused** (`hit_count`).
- **Attempts / duration** first run vs last run.
- **Failures pre-empted** (retries avoided by a retrieved skill).

**Demo script (SkyNotes testbed on Alibaba Cloud):**
1. Fresh skills DB → deploy → the agent fumbles on a real error, its self-healing
   loop diagnoses it, learns a skill, and retries to success (N attempts).
2. Same task again → the agent retrieves the skill up front and deploys clean in
   1 attempt. The delta report shows attempts N→1 and a lower duration.
3. Same pattern on the UI-tester: a bug found on run 1 becomes a learned skill;
   run 2 regression-checks it first.

## Where it shows in the product

The deploy result message now surfaces the loop explicitly: on failure it says a
new skill was learned and offers retry; on success it reports "self-healed after
N attempts" and which skill was learned. The App Home dashboard shows
`skills_learned` and `retries_avoided` counters that climb over time.

## Why it's real, not theater

The skills are authored by the agent from *actual* deploy/test failures on real
infrastructure, stored in a real vector DB, and retrieved by semantic similarity
— and the same lessons transfer across backends via a re-embedding migration.
The agent is dumb on attempt one and sharp by attempt N, exactly as the track asks.
