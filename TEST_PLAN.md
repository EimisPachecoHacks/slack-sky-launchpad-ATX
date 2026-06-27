# Sky Launchpad — Test Plan

**Project:** Sky Launchpad (self-improving cloud-infrastructure agent)
**Scope:** the hackathon contribution (self-improving loop) + the AI-provider swaps (MiniMax, Gemini vision, Gemini Live voice), plus the surrounding app.
**Date:** 2026-06-27

Legend: ✅ verified · ⏳ ready to run · 🔑 needs live API key · 👤 manual/UI

---

## 1. Test environment

| Item | Value |
|---|---|
| Backend | FastAPI + uvicorn, `http://localhost:8000` |
| Frontend | Vite dev server, `http://localhost:3001` (proxies `/api` → `:8000`) |
| Python venv | `project/venv` (deps from `backend/requirements.txt` + `boto3`) |
| CLI / loop | `deployer/` package (run from repo root) |
| Keys needed for live tests | `MINIMAX_API_KEY`, `GEMINI_API_KEY` in `project/.env` |

**Setup commands**
```bash
# Backend
cd project && ./venv/bin/uvicorn backend.api.main:app --host 0.0.0.0 --port 8000
# Frontend (separate shell)
cd project && npm run dev
```

**Exit criteria:** all ✅/⏳ tests pass; all 🔑 tests pass once real keys are set; no P1 defects open; demo flow (Section 6) runs end-to-end.

---

## 2. Unit / smoke tests (offline — no keys, no network)

| ID | Component | Command | Expected | Status |
|---|---|---|---|---|
| U-1 | Antigravity repair agent | `python deployer/antigravity_client.py` | Prints `PASS`; returns `fixed_files`, `new_skill.markdown`, `env_id`; uses fallback path | ✅ |
| U-2 | Skill library (save + retrieve) | `python deployer/skill_library.py` | `PASS`; compute-API skill ranks first for query "compute.googleapis.com has not been enabled"; real `skills/learned/` untouched | ✅ |
| U-3 | Log collector | `python deployer/log_collector.py` | `PASS`; `terraform_errors` non-empty; `cloud_logs == []` with explanatory note (no creds) | ✅ |
| U-4 | Backend modules compile | `python -m py_compile backend/config.py backend/minimax_client.py backend/gemini_client.py backend/agents/*.py backend/gemini_live.py backend/api/main.py` | Exit 0 | ✅ |
| U-5 | Client imports load | `./venv/bin/python -c "from backend.minimax_client import minimax_chat; from backend.gemini_client import vision, transcribe_audio; print('OK')"` | Prints `OK` | ✅ |
| U-6 | Config tolerates extra .env keys | Start backend with `.env` containing `ANTIGRAVITY_MODEL` | No `extra_forbidden` error; config validates | ✅ |
| U-7 | Existing backend pytest suite | `cd project && ./venv/bin/pytest backend/tests -q` | Suite runs; note `test_api.py` asserts `/health` service string (unchanged by design) | ⏳ |

---

## 3. API endpoint tests (backend running, no keys required)

| ID | Endpoint | Command | Expected | Status |
|---|---|---|---|---|
| A-1 | Health | `curl -s localhost:8000/health` | `{"status":"ok",...}` 200 | ✅ |
| A-2 | Learned-skills metrics | `curl -s localhost:8000/api/skills/learned` | `{"count":...,"total_retries_avoided":...,"skills":[...]}` 200 | ✅ |
| A-3 | Gemini Live health | `curl -s localhost:8000/api/live/health` | `{"gemini_live":<bool>,"model":"gemini-3.1-flash-live-preview"}` | ✅ |
| A-4 | Live narration WS | connect WS `ws://localhost:8000/api/live/narrate` | Accepts; sends `{"type":"ready",...}`; streams text frames; no crash when key/SDK absent | ⏳👤 |
| A-5 | Voice transcribe (no audio) | `curl -s -X POST localhost:8000/api/voice/transcribe` (no file) | 422/400 validation error, not 500 | ⏳ |
| A-6 | Removed ElevenLabs route | `curl -s -o /dev/null -w "%{http_code}" localhost:8000/api/scribe-token` | 404/405 (endpoint removed) | ✅ |
| A-7 | Rate limiting | fire >10 req/min to a rate-limited route | 429 after limit | ⏳ |

---

## 4. Provider integration tests (🔑 require live keys)

Set real keys in `project/.env` first.

| ID | Provider | How | Expected | Status |
|---|---|---|---|---|
| P-1 | MiniMax — architecture JSON | agent `generate_architecture()` + `parse_claude_architecture_response()` (verified directly; HTTP route needs JWT) | Parsed `architecture` JSON: 8 GCP services, total_cost $175.85. MiniMax-M2 emits a `<think>` preamble then a ```json block — parser handles it. | ✅ |
| P-2 | MiniMax model id honored | backend log on startup | `MiniMax Model: MiniMax-M2` | ✅ |
| P-3 | Gemini vision — image analysis | `vision()` on a sample diagram (verified directly; HTTP route needs JWT) | Correctly identified AWS data-lake services (Kinesis, Glue, S3, Athena, EMR, SageMaker, …) | ✅ |
| P-4 | Gemini vision model id | confirm call uses `gemini-3.1-pro-preview` (default) | Vision call succeeded on `gemini-3.1-pro-preview` | ✅ |
| P-5 | Gemini voice transcription | `POST /api/voice/transcribe` with a short audio clip | 200; `{"success":true,"text":"Design a photo sharing application on Google Cloud…"}` in ~1.9s (model `gemini-3.1-flash-lite`) | ✅ |
| P-6 | Graceful failure w/o key | unset a key, call its route | Clear error (RuntimeError surfaced as 500 with message), server stays up | ⏳ |
| P-7 | Antigravity managed agent | trigger a real failed deploy (see E-1) with `GEMINI_API_KEY` | Interactions API call attempted with `antigravity-preview-05-2026`, `env_id` reused across retries; fallback only if preview unavailable | 🔑 |

---

## 5. Self-improving loop tests (the hackathon star)

| ID | Scenario | Steps | Expected | Status |
|---|---|---|---|---|
| L-1 | Learn on failure (unit) | U-1 + U-2 already cover diagnose→author→persist offline | New `SKILL.md` authored and indexed | ✅ |
| L-2 | Repair wiring | Inspect `deploy_with_retry` / `web.py` use `_repair_failure` | On failure: collect context → Antigravity → save skill → retry; legacy regex fixer is fallback | ✅ (code) |
| L-3 | Persistence | `save_skill(...)` then check filesystem | `skills/learned/<slug>/SKILL.md` (synthesized from fields) + `skills/learned/_index.json` created | ✅ |
| L-4 | Transfer / pre-emption | `skills_loader.get_skills_context()` + `skill_library.retrieve_skills()` | Generation context contains `LEARNED SKILL` block; retrieval matched the skill (score 0.59) | ✅ |
| L-5 | Metrics reflect learning | `GET /api/skills/learned` after L-3 | `count:1`, learned skill listed | ✅ |

---

## 6. End-to-end demo flow (👤 needs GCP creds + keys)

Goal: prove "it learns, and the lesson transfers."

| ID | Step | Expected |
|---|---|---|
| E-1 | Deploy a config that fails deterministically (e.g. GCP project with a **disabled API**) via CLI `python -m deployer.main --provider gcp` or the web UI | `terraform apply` fails; loop captures error + cloud logs |
| E-2 | Agent diagnoses + fixes + retries | Repair agent runs; IaC fixed; retry **succeeds**; a new `skills/learned/*` SKILL.md is authored |
| E-3 | (Optional) Live narration on | Toggle voice on the deploy page → hear/read narration of the loop phases |
| E-4 | Second, different deploy that would hit the same error class | Learned skill retrieved + injected; deploy **succeeds on attempt 1** (failure pre-empted) |
| E-5 | Metrics + GitLab | Learned-skills panel ticks up; (if configured) validated code committed to GitLab as an MR |

---

## 7. Frontend / UI tests (👤)

| ID | Area | Steps | Expected | Status |
|---|---|---|---|---|
| F-1 | App loads & branding | open `http://localhost:3001` | App renders; brand reads "Sky Launchpad"; no console import errors | ⏳👤 |
| F-2 | TypeScript build | `cd project && npx tsc --noEmit` (or `npm run build`) | No type errors; `LiveNarrationToggle.tsx`, `VoiceInput.tsx` compile | ⏳ |
| F-3 | Voice input (Gemini) | click mic on requirements form, speak, stop | Records via MediaRecorder, POSTs to `/api/voice/transcribe`, transcript fills field | 🔑👤 |
| F-4 | Live narration toggle | enable on deploy page | Opens WS; plays audio or browser-speech fallback; no UI break | 🔑👤 |
| F-5 | No ElevenLabs references | grep `src/` for `elevenlabs` | Zero matches; dependency removed from `package.json` | ✅ |

---

## 8. Regression / negative tests

| ID | Check | Expected | Status |
|---|---|---|---|
| R-1 | No stray Anthropic/ElevenLabs imports in backend | `grep -rn "import anthropic\|from elevenlabs" project/backend` | none | ✅ |
| R-2 | Servers start with placeholder keys | start backend with default `.env` | Boots; warns that keys unset; endpoints up | ✅ |
| R-3 | Repo hygiene | `git status` | `venv/`, `node_modules/`, `.env` not tracked | ✅ |
| R-4 | Offline degradation | run loop with no `GEMINI_API_KEY` | Falls back gracefully; no crash | ✅ |

---

## 9. Known limitations / preview risks (track as test blockers)

- **Preview model IDs** (`MiniMax-M2`, `gemini-3.1-pro-preview`, `gemini-3.1-flash-live-preview`, `antigravity-preview-05-2026`) require account access; verify before P-/E- tests.
- **E2E (Section 6)** mutates real cloud resources — run in a throwaway GCP project and destroy after (`terraform destroy`).
- Voice transcription uses a record-then-POST model (not full duplex streaming); acceptable for the demo.
- **HTTP auth:** `/api/architecture/*` require a **JWT** + `X-API-Key` per the app's auth layer. **Local dev:** with `API_KEYS=` and `JWT_SECRET_KEY=` empty and `API_ENVIRONMENT=development`, auth is bypassed (verified: `/api/architecture/generate` returned 200 via HTTP). **Do not deploy with auth disabled** — set real keys for production.
- **MiniMax-M2 reasoning preamble:** responses begin with a `<think>…</think>` block before the ```json output. The current parser extracts the JSON block correctly; keep the ```json instruction in the system prompt.
- **Gemini live model is WebSocket-only:** `gemini-3.1-flash-live-preview` supports only `bidiGenerateContent` (streaming), so it cannot serve the record-then-POST `/api/voice/transcribe`. Transcription uses `GEMINI_TRANSCRIBE_MODEL` (default `gemini-3.1-flash-lite`, a `generateContent` audio model — verified). The live model remains for the streaming narration WS (`gemini_live.py`).

---

## 10. Quick run order

1. Section 2 (offline smoke) — fast confidence. ✅ already green.
2. Start servers → Section 3 (endpoints). 
3. Add keys → Section 4 (providers) + Section 7 voice/UI.
4. Section 5 + Section 6 (the learning loop + E2E) — the demo proof.
