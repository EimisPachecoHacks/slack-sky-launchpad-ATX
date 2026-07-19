# Sky Launchpad — Slack App

The Sky Launchpad UI, rebuilt as a **Slack app**. Design cloud architectures in plain English (or from a diagram image), review components and costs, generate Terraform/CloudFormation, and run a real deployment — all without leaving Slack. It reuses the existing FastAPI backend in `project/backend`; this folder is a pure frontend and touches nothing else in the repo.

## What it looks like

| Web app | Slack app |
|---|---|
| Home / dashboard page | **App Home tab** — backend health, learned-skills stats, provider quick-starts, recent architectures |
| Method choice (wizard vs image) | `/sky` entry card, or the first step of the wizard **modal** |
| Provider selection cards | Provider cards inside the wizard modal |
| Use-case form (title, description, requirements) | Input blocks in the wizard modal (requirements = one per line) |
| Architecture diagram + component list | **Review message**: card + component table with per-component and total monthly cost, AI reasoning in a thread |
| Code generator tabs | **Code message**: Terraform / CloudFormation buttons, code delivered as a snippet (or inline when short) |
| Deployment form + log console | **Deploy modal** (account, region, repo, confirmation) → live progress message → success card with endpoint + GitLab MR, full `deploy.log` in a thread |

Rich agent blocks (`card`, `data_table`) are used where Slack supports them, with automatic classic-block fallback everywhere else.

## Prerequisites

1. **Backend running** — from `project/`:
   ```bash
   uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
   ```
2. **Backend API key** — deployment and account listing require auth. Set `API_KEYS=<some-key>` in `project/.env`; use the same value as `SKY_API_KEY` here.
3. Node.js ≥ 18.

## Create the Slack app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From a manifest** → pick your workspace → paste the contents of [`manifest.json`](manifest.json).
2. **Install to Workspace**, then copy the **Bot User OAuth Token** (`xoxb-…`) from *OAuth & Permissions*.
3. Under *Basic Information → App-Level Tokens*, create a token with the `connections:write` scope and copy it (`xapp-…`).

## Run

```bash
cd slack
cp .env.example .env    # fill in SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SKY_API_KEY
npm install
npm start
```

Socket Mode means no public URL, tunnels, or signing secret are needed.

## Usage

- `/sky` — start card · `/sky new` — open the wizard directly · `/sky status` — backend health · `/sky help`
- **Home tab** — the dashboard; everything can be started from there.
- **DM the bot an image/PDF** of an architecture diagram — Nemotron vision reconstructs it, then the same review → code → deploy flow applies.
- Mention the bot in a channel for the start card.

Flow: describe project → review architecture and costs → generate code → **Deploy** (pick account/region, confirm billable resources) → progress with elapsed time → success card with endpoint URL and GitLab MR link.

## Tests

```bash
npm run test:blocks        # block builders produce valid Block Kit shapes (no Slack needed)
npm run smoke              # against a live backend: health, skills, credentials
RUN_GENERATE=1 npm run smoke   # additionally exercises a real LLM generate call
```

## Architecture notes

- Single process, **in-memory sessions** (reset on restart — old buttons then answer "session expired"). Architecture JSON is kept server-side in the session store; Slack only ever carries a short session id in `private_metadata`/button values.
- Slow calls (generate ≈ 20–60 s, deploy ≈ minutes) never block a modal: the modal closes and a message shows elapsed time via `chat.update` until the result replaces it.
- `src/blocks/common.js` posts rich blocks first and falls back to classic blocks if a surface rejects them.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `missing_scope` / image download returns HTML | Reinstall the app from the manifest (scopes changed) |
| `expired_trigger_id` | Slow network between click and modal open — just click again |
| Deploy modal says accounts failed to load | Set `SKY_API_KEY` in `slack/.env` matching `API_KEYS` in `project/.env` |
| "backend is rate-limiting" | Backend allows 10 req/min per IP — wait a moment |
| Buttons answer "session expired" | The app restarted; sessions are in-memory — run `/sky new` |
