> **SUPERSEDED — historical design doc, not the shipped architecture.**
>
> This plan targeted Gemini Computer Use + Google ADK. Both were removed when the
> project moved to a fully open, AMD-hosted stack for the AMD Developer Hackathon:
> ACT II. No OpenAI-compatible provider serves a computer-use-tuned model, and
> Gemma 3 is not grounded for pixel-level click targeting, so the autonomous
> vision-action driver (`computer_use_agent.py`) was cut.
>
> **What shipped instead:** bug *discovery* is manual (drive the app with
> `ui_tester/playwright_client.py`); bug *repair* remains autonomous via
> `POST /api/uitest/fix`, which now runs Gemma 3 on the MI300X through
> `backend/llm_client.py`. Kept for provenance.

---

# Sky Launchpad — Autonomous UI Self-Healing (Benji-inspired)

## Goal
Make Sky Launchpad **self-test its own UI, self-diagnose UI bugs, auto-fix them, redeploy, and open a GitLab MR** — using the same tech stack as Benji (Gemini Computer Use + Playwright + Google ADK/MCP), wired into our existing self-improving loop so UI failures become *learned skills* too (Continual Learning).

## Feasibility (verified with the live key)
- `gemini-2.5-computer-use-preview-10-2025` ✅ available
- `gemini-2.5-pro` ✅ available (fix agent)
- `google-adk`, `playwright` install cleanly; `google-genai` already in use.
- A "continuous software tester" is **explicitly encouraged** by the Gemini $5k brief (Computer Use use-case). Framed as *self-healing*, it fits the **Continual Learning** theme. Not a banned category.

## Architecture (adapted from Benji → Sky Launchpad)
```
NL workflow ─► Computer Use Agent (gemini-2.5-computer-use) ──screenshot/action──► Playwright client ─► live frontend (:3001 / Cloud Run)
                       │  vision-action loop (sees screen, acts, re-observes)
                       ▼ bug detected (workflow break / console error / blank state)
              Fix Agent (Google ADK + gemini-2.5-pro + GitLab tools)
                       │  investigate frontend source → root-cause → patch
                       ▼
              GitLab branch + commit + Merge Request   ──►   Redeploy (local rebuild | Cloud Run)
                       │
                       ▼  re-run the same workflow to VERIFY the fix
              Record UI bug→fix as a learned skill + deploy event  ──►  Learning dashboard (new "UI" category)
```
Two specialized agents (like Benji), plus our continual-learning glue.

## Reuse (don't rebuild)
- **GitLab MR**: `project/backend/gitlab_client.py` (`create_branch`/`create_commit`/`create_merge_request`) and `deployer/gitlab_saver.py`.
- **Gemini**: `project/backend/gemini_client.py` (vision) + `google-genai` client.
- **Continual-learning glue**: `deployer/skill_library.py` (persist UI fix as a skill), `deployer/deploy_events.py` (timeline), `project/backend/learning.py` + `LearningPanel.tsx` (dashboard).
- **Observability**: `project/backend/observability.py` (Logfire) — trace every Computer-Use turn + fix.
- **Cloud Run redeploy**: existing `gcloud builds submit` + `gcloud run deploy` flow (README).

## New components
All new code lives under a new `ui_tester/` package + a backend router + one frontend panel.

1. `ui_tester/playwright_client.py` — local Playwright client (adapt Benji): connects to backend via WS; handles `request_screenshot` + `execute_action`; coordinate denormalization (model 0–1000 → pixels); actions `click_at`, `type_text_at`, `navigate`, `scroll_at`, `drag`, `key_combination`; returns screenshot + URL + console errors after each action.
2. `ui_tester/computer_use_agent.py` — the vision-action loop. `GenerateContentConfig(tools=[Tool(computer_use=ComputerUse(environment=ENVIRONMENT_BROWSER))])`, model `gemini-2.5-computer-use-preview-10-2025`. Sends screenshot+intent → executes returned `function_call`s via the Playwright WS → appends `FunctionResponse(screenshot,url)` → repeats. Emits structured events (thought/action/screenshot/verdict) and a **bug signal** when the workflow can't be completed.
3. `ui_tester/ui_fix_agent.py` — Google ADK `LlmAgent` (gemini-2.5-pro) with **GitLab function tools** wrapping `gitlab_client` (read_file, list_files, create_branch, commit, open MR). Receives the failed session (screenshots, actions, bug context), root-causes in the frontend source, patches, and opens a GitLab MR with a structured body (Summary / Root Cause / Changes / Validation / Git Actions). *Optional:* point ADK `McpToolset` at a GitLab MCP URL if configured (`GITLAB_MCP_URL`) for the "same MCP tech" alignment; default to our REST tools.
4. `ui_tester/redeploy.py` — `REDEPLOY_MODE=local` (vite build + restart dev server) or `cloudrun` (`gcloud builds submit` → `gcloud run deploy`). Returns the live URL to re-test against.
5. `ui_tester/workflows.py` — NL workflow definitions to test (e.g., "Generate an architecture for a photo app and confirm the diagram + learning panel render", "Toggle voice input", "Open deploy page").
6. **Backend**: `POST /api/uitest/run` (start a workflow), WS `/api/uitest/stream` (live screenshots + agent thoughts/actions + verdict), `GET /api/uitest/results`. Mount in `project/backend/api/main.py`.
7. **Frontend**: `project/src/components/uitest/SelfTestPanel.tsx` — dual-pane live view (left: agent thoughts/actions/verdict; right: streamed screenshots), embedded as a secondary panel (loop stays the headline).
8. **Orchestrator** (`ui_tester/orchestrator.py`): test → detect → fix → MR → redeploy → re-verify → record learned skill + event. Owned by me (integration).

## The self-healing loop (end to end)
1. Pick/define an NL workflow; Computer Use agent drives the live UI (vision-action), streaming to the Self-Test panel.
2. On a real break (agent reasons the goal is unreachable, or a console error / blank render), capture the session bundle.
3. Fix agent investigates the frontend repo, patches the root cause, opens a **GitLab MR**.
4. Apply locally → **redeploy** (local rebuild or Cloud Run).
5. **Re-run** the same workflow to confirm green (verification).
6. Persist the UI bug→fix as a **learned skill** + timeline event → shows in the **learning dashboard** (new "UI" category, error→solution table).

## Tech included (matches Benji)
gemini-2.5-computer-use-preview · gemini-2.5-pro · gemini-multimodal-vision · Google ADK · MCP (optional GitLab MCP) · google-genai SDK · Playwright · FastAPI · WebSockets · Cloud Run · React (our Vite app vs Benji's Next.js).

## Build team (parallel agents — disjoint files, build to the contracts below)
Contracts fixed up front so agents don't block each other:
- **WS action schema**: `{type:"execute_action", function_name, args}` → reply `{screenshot, url, console_errors}`; `{type:"request_screenshot"}` → `{screenshot}`.
- **Stream event schema**: `{kind:"thought"|"action"|"screenshot"|"verdict", ...}`.
- **Session bundle** (test→fix): `{workflow, steps:[{thought,action,screenshot,url}], bug:{signal,step,console_errors}}`.

| Agent | Owns (new files only) | Output |
|---|---|---|
| **A — Playwright Client** | `ui_tester/playwright_client.py` + `ui_tester/requirements.txt` | Coordinate browser control + screenshot/console streaming over WS (adapt Benji). |
| **B — Computer-Use Agent** | `ui_tester/computer_use_agent.py` | Vision-action loop (gemini-2.5-computer-use), bug detection, emits stream events + session bundle. Builds to A's WS schema. |
| **C — Fix Agent (GitLab)** | `ui_tester/ui_fix_agent.py` | ADK + gemini-2.5-pro + GitLab tools (reuse `gitlab_client`) → branch/commit/MR with structured body. |
| **D — Redeploy + Workflows** | `ui_tester/redeploy.py`, `ui_tester/workflows.py` | local/cloudrun redeploy wrapper + NL workflow library. |
| **E — Backend API/WS** | new router `project/backend/uitest_api.py` (mounted in main.py by me) | `/api/uitest/run`, WS `/api/uitest/stream`, `/api/uitest/results`. Builds to B's event schema. |
| **F — Frontend panel** | `project/src/components/uitest/SelfTestPanel.tsx` (+ embed by me) | Dual-pane live view; consumes E's WS. |
| **Orchestrator (me)** | `ui_tester/orchestrator.py`, mount router, embed panel, learning-loop glue | Wire test→fix→redeploy→verify→learn; integrate skill_library/deploy_events/learning dashboard. |

## Phasing (recommended)
- **Phase 1 (MVP, demoable):** A + B + E + F — Computer Use agent self-tests the live UI with a live dual-pane stream and reports pass/fail. (Highest visual impact, lowest risk.)
- **Phase 2:** C + redeploy — auto-fix → GitLab MR → redeploy → re-verify.
- **Phase 3:** learning-loop glue — UI bugs→fixes become learned skills in the dashboard.

## Risks & mitigations
- **Computer-Use is preview / coordinate accuracy** → verified available; keep workflows short and deterministic; cap turns; clear failure signals (Benji's main challenge — invest in bug-vs-retry grounding).
- **Auto-fix safety** → never auto-merge; open an MR for human review (matches "validate-then-save"). Redeploy a fix only after re-verify passes, or gate behind a flag.
- **Cloud Run redeploy needs gcloud auth/project** → default `REDEPLOY_MODE=local` (vite rebuild + restart) for the demo; Cloud Run optional.
- **Playwright runs locally** (the client is a local process), backend can be local or Cloud Run — same split as Benji.
- **Scope** → ship Phase 1 first; Phases 2–3 are independent increments.

## Verification
- Phase 1: run a known-good workflow → agent completes it, panel streams screenshots+actions, verdict=pass. Introduce a deliberate UI break → verdict=fail with a clear bug signal.
- Phase 2: confirm a GitLab MR is opened with the structured body; redeploy succeeds; re-run goes green.
- Phase 3: learned skill appears in `/api/learning/summary` (UI category) and the dashboard table.
