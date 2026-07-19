# Teammate handoff — Sky Launchpad NVIDIA hackathon build

State of the NVIDIA/Slack side as of this handoff. Read `nvidia/README.md`,
`docs/NVIDIA_BACKEND_PLAN.md`, and `docs/NVIDIA_HACKATHON_BOUNTIES.md` for the
full picture. This file is the "what's done / what's left / how to help" summary.

## The one-line story

Slack UI (agent-as-user) → NVIDIA backend (port 8020) → **self-hosted Nemotron
3 Nano 30B on vLLM** (our GPU box `sky-nvidia`) → designs cloud architecture,
generates Terraform, deploys to Alibaba, then an **AI agent tests the deployed
app like a human** (screenshot → Nemotron vision → click) and **learns a skill
from every bug** (Supabase pgvector) so it gets smarter each run. The tester
runs **contained by NemoClaw + OpenShell**. Targets four things: Recursive
Intelligence track + vLLM, Nemotron, and NemoClaw/OpenShell bounties.

## Setup (see the message you were sent, or nvidia/serving/SHARED_ENDPOINT.md)

`nvidia/.env` points at the shared Nemotron endpoint — no GPU or Brev CLI needed.
Run: `cd nvidia && ../project/venv/bin/python -m uvicorn backend.api.main:app --port 8020`.
Verify: `curl localhost:8020/` → `"llm_provider":"nemotron"`, `"llm_connected":true`.

## DONE (working + verified)

- **Dual backend**: `project/backend` (Qwen, FROZEN — do not touch) and
  `nvidia/backend` (Nemotron). Kept in sync by `scripts/sync-backends.sh`
  (SHARED mirrored, PROTECTED files diverge: `config.py`, `llm_client.py`,
  `serving/`, `metrics/`, `skills_store/`).
- **Self-hosted vLLM** serving Nemotron 30B on `sky-nvidia`, exposed to the team
  over one authenticated public URL (`nvidia/serving/`). Restart with
  `nvidia/serving/start-vllm.sh`.
- **Skills memory** on Supabase pgvector (`skydb` auto-selects it when
  `SUPABASE_URL` is set; Qwen side still uses Mongo). Migration that re-embeds
  skills across vector spaces: `nvidia/backend/skills_store/migrate_from_qwen.py`.
- **Slack app** (`slack/`): App Home, wizard modal, review/code/deploy, plus a
  "🧪 Test this app" button and `/sky test <url>`. Full flow verified with
  screenshots (Slack → Nemotron designs a 4-component Alibaba architecture).
- **Testbed target app** (`nvidia/testbed/`): tiny signup+todo site with 2
  seeded bugs; Alibaba Terraform + `deploy.sh`/`destroy.sh`.
- **UI test agent** (`nvidia/tester/agent.py`): the computer-use loop; saves a
  screenshot per step, records verdicts to Supabase, learns skills from bugs.
- **Deterministic Slack driver** (`nvidia/tester/slack_ui_flow.py`): reliable
  scripted demo of our own Slack UI (use this for the demo video; the vision
  agent is for testing UNKNOWN apps).
- **Recursive Intelligence metrics** (`nvidia/backend/metrics/delta_report.py`).
- **NemoClaw/OpenShell** policy + adversarial test + blueprint mapping authored
  in `nvidia/nemoclaw/` (NOT yet installed/run on the box — see below).

## REMAINING (good places to help)

1. **Harden the vision tester** (`nvidia/tester/agent.py`) — biggest quality gap.
   It reaches verdicts but is ~40% reliable: typing into fields sometimes
   misses. Needed: after each action, screenshot-diff to confirm the screen
   changed (retry/re-aim if not); verify typed text actually appears; consider
   the `nemotron-3-nano-omni-30b-a3b-reasoning` VL model (read pages better in
   testing). Goal: reliably find both seeded bugs in the testbed.
2. **Deploy the testbed to Alibaba** (`nvidia/testbed/deploy.sh`) and run the
   vision tester against the real public URL end-to-end.
3. **Actually install + run NemoClaw** on `sky-nvidia` per
   `nvidia/nemoclaw/NEMOCLAW.md`, wrap the tester, run `adversarial_test.sh`,
   capture the "boundary held" output for judges.
4. **Submission artifacts**: the three short write-ups (Nemotron / vLLM /
   NemoClaw-policy — outlines in `docs/NVIDIA_HACKATHON_BOUNTIES.md`), an
   architecture diagram, and the demo video (use the Slack driver run).
5. **GitHub push** is blocked: the fine-grained token needs **Contents: Read and
   write** for `slack-sky-launchpad-ATX`. Two commits are staged locally.

## Rules

- Never edit `project/backend/` (frozen Qwen submission, due separately).
- Improvements go in `project/backend` then `scripts/sync-backends.sh`, UNLESS
  they're NVIDIA-specific (then they belong in a PROTECTED path).
- Keep the shared endpoint URL + keys out of git.
- The GPU box bills ~$2/hr — coordinate before stopping it (others depend on it).
