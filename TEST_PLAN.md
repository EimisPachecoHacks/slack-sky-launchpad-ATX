# Sky Launchpad — Test Plan

**Project:** Sky Launchpad (self-improving cloud-infrastructure agent)
**Scope:** the self-improving loop, the all-AMD inference stack (Gemma 4 + mxbai-embed-large + Whisper on ROCm), and the surrounding app.
**Last updated:** 2026-07-10

Legend: ✅ verified · ⏳ ready to run · 🎮 needs the GPU pod · 👤 manual/UI · 🔑 needs live cloud creds

---

## 1. Test environment

| Item | Value |
|---|---|
| Backend | FastAPI + uvicorn, `http://localhost:8080` |
| Frontend | Vite dev server, `http://localhost:3001` (proxies `/api` → backend) |
| Inference | Ollama on ROCm, `http://localhost:11434/v1` (`gemma4:31b`, `mxbai-embed-large`) |
| Speech-to-text | `services/whisper_server.py`, `http://localhost:8100/v1` |
| CLI / loop | `deployer/` package (run from repo root) |
| Keys needed | **None for inference.** `MONGODB_URI` for Atlas; `GITLAB_TOKEN` for MRs; cloud creds for real deploys. |

**Setup**
```bash
# GPU stack — hackathon pod (managed container, no docker run)
bash scripts/pod_up.sh --check     # probe only, does not start the GPU clock
bash scripts/pod_up.sh             # Ollama + models + Whisper

# GPU stack — Developer Cloud droplet (real Docker host)
docker compose -f docker/docker-compose.amd.yml up

# Backend
cd project && uvicorn backend.api.main:app --host 0.0.0.0 --port 8080
```

**Exit criteria:** all ✅/⏳ pass; all 🎮 pass on the pod; no P1 defects; the demo flow (§6) runs end to end and the *second* run of the same requirement does not fail.

---

## 2. Unit / smoke tests (offline — no keys, no network, no GPU)

| ID | Component | Command | Expected | Status |
|---|---|---|---|---|
| U-1 | Repair agent | `python3 deployer/repair_agent.py` | Prints `PASS`; returns `fixed_files`, `new_skill.markdown`, `env_id="single-shot"`; unparseable model output still yields a synthesized skill | ✅ |
| U-2 | Skill library (save + retrieve) | `python3 deployer/skill_library.py` | `PASS`; compute-API skill ranks first for "compute.googleapis.com has not been enabled"; real `skills/learned/` untouched | ✅ |
| U-3 | Log collector | `python3 deployer/log_collector.py` | `terraform_errors` non-empty; `cloud_logs == []` with `cloud_logs_note` explaining no GCP creds. Never raises | ✅ |
| U-4 | Everything compiles | `python3 -m compileall -q project/backend deployer skydb scripts services` | Exit 0 | ✅ |
| U-5 | App imports, routes intact | `cd project && python3 -c "import sys;sys.path.insert(0,'.');from backend.api.main import app;print(len(app.routes))"` | `33` | ✅ |
| U-6 | Config tolerates stale `.env` keys | Start backend with a `.env` still containing `GEMINI_API_KEY`, `MINIMAX_*` | No `extra_forbidden`; config validates (`extra="ignore"`) | ✅ |
| U-7 | Backend pytest suite | `cd project/backend && pytest` | Runs bare, without `pytest-cov` installed: **10 failed, 83 passed, 11 skipped**. All 10 failures are in `test_api.py` and are an *identical set* before and after the AMD port — pre-existing, not introduced here | ✅ |
| U-8 | Retrieval reads the real SKILL.md | `python3 -c "import sys;sys.path.insert(0,'.');from deployer.skill_library import retrieve_skills;print(len(retrieve_skills('generate architecture button no loading feedback')[0]['content']))"` | Non-zero (`1333`). Guards the stale-absolute-path defect | ✅ |
| U-9 | Retrieval degrades without a GPU | Same as U-8 with no embedding endpoint reachable | Logs `embedding unavailable …; retrieval falls back to lexical`; still returns a scored hit | ✅ |

---

## 3. Inference-client contract tests (no GPU — stub server)

| ID | Surface | Expected | Status |
|---|---|---|---|
| C-1 | `chat()` | `POST {LLM_BASE_URL}/chat/completions`, `Authorization: Bearer …`, parses `choices[0].message.content` | ✅ |
| C-2 | `vision_chat()` | Content array `[{type:"image_url", image_url:{url:"data:image/png;base64,…"}}, {type:"text"}]`. Ollama accepts base64 data URIs; it rejects remote `http(s)` image URLs | ✅ |
| C-3 | `transcribe()` | `multipart/form-data` to `{LLM_AUDIO_BASE_URL}/audio/transcriptions` with `file` + `model` | ✅ |
| C-4 | `embed()` — no `dimensions` | Payload keys are exactly `{model, input}`. Ollama ignores a `dimensions` field, so we never send it | ✅ |
| C-5 | `embed()` — opt-in `dimensions` | `EMBED_SEND_DIMENSIONS=true` re-adds the field (Matryoshka models only) | ✅ |
| C-6 | Embedding width guard | Endpoint returns 1024-d while `EMBED_DIMENSIONS=768` → returns `None`, logs an error, writes nothing | ✅ |
| C-7 | Model resolution | `LLM_PROVIDER=amd` → `gemma4:31b` @ `:11434`; an explicit `LLM_MODEL` overrides the default | ✅ |

---

## 4. GPU tests 🎮 (on the pod — these burn the 8h/24h budget)

| ID | Check | Command | Expected | Status |
|---|---|---|---|---|
| G-1 | Environment probe | `bash scripts/pod_up.sh --check` | `gfx942`; ROCm version printed; reports whether `docker` and `ffmpeg` exist | ⏳🎮 |
| G-2 | **GPU residency** | `ollama ps` | `PROCESSOR` column reads **GPU**. If it reads `CPU`, the ROCm runtime never loaded — stop and fix before anything else | ⏳🎮 |
| G-3 | Both models resident | `rocm-smi` | Gemma 4 and the embedder visible on one MI300X | ⏳🎮 |
| G-4 | Chat endpoint | `curl :11434/v1/chat/completions -d '{"model":"gemma4:31b","messages":[{"role":"user","content":"hi"}]}'` | 200, non-empty `choices[0].message.content` | ⏳🎮 |
| G-5 | Embedding width | `curl :11434/v1/embeddings -d '{"model":"mxbai-embed-large","input":"compute api disabled"}'` | `data[0].embedding` length **1024** | ⏳🎮 |
| G-6 | **Gemma 4 vision** (highest risk) | Upload a diagram via the UI | Structured JSON returned. Multimodal on ROCm is the least-proven path; the loop does not depend on it | ⏳🎮👤 |
| G-7 | Whisper health | `curl :8100/health` | `{"gpu": true, "hip": "…"}` — a non-null `hip` proves it is an AMD build | ⏳🎮 |
| G-8 | Whisper decodes webm | Record via the mic button | Transcript returned. **Requires the `ffmpeg` binary**; without it, expect a 500 naming ffmpeg | ⏳🎮👤 |
| G-9 | Stop the clock | `bash scripts/pod_down.sh` | Both processes stopped; `rocm-smi --showpids` clean | ⏳🎮 |

---

## 5. Self-improving loop tests (the star) 🎮🔑

| ID | Step | Expected | Status |
|---|---|---|---|
| L-1 | Atlas index created | Vector index on `skills`: `numDimensions: 1024`, `path: "embedding"`, `similarity: cosine` | ⏳ |
| L-2 | Re-embed after a model change | `python3 scripts/migrate_vector_index.py` refuses if the endpoint is down or the width mismatches; otherwise re-embeds every skill with `force=True` | ⏳🎮 |
| L-3 | Failure → repair | Deploy a config that fails on a disabled GCP API. Gemma 4 diagnoses and rewrites the HCL | ⏳🎮🔑 |
| L-4 | Repair → skill | `skills/learned/<slug>/SKILL.md` appears; `_index.json` gains an entry with a **repo-relative** `path` and a 1024-d `embedding` | ⏳🎮🔑 |
| L-5 | **Transfer (the money shot)** | Re-run the *same* requirement. The learned skill is retrieved by `$vectorSearch` and injected into generation. **The failure does not recur.** | ⏳🎮🔑 |
| L-6 | Reuse is counted | `GET /api/skills/learned` shows `hit_count > 0` for the retrieved skill | ⏳🎮🔑 |
| L-7 | No GPU → graceful | Stop `ollama`. Retrieval falls back to lexical cosine; nothing writes a foreign vector into Atlas | ✅ (unit-level, U-9) |

---

## 6. End-to-end demo flow 🎮🔑👤

1. Bring up the stack (`pod_up.sh` or `docker compose`). Show `rocm-smi` and `ollama ps` (PROCESSOR = GPU).
2. Describe an infrastructure need in the UI → Gemma 4 returns architecture JSON + Terraform.
3. `terraform apply` **fails** on a disabled Compute Engine API.
4. Narration streams the phases: `failure` → `diagnose` → `learned` → `retry`.
5. Gemma 4 authors `skills/learned/gcp-enable-compute-api/SKILL.md`.
6. Retry succeeds → GitLab MR opens.
7. **Re-run the identical requirement.** The skill is retrieved; the API is pre-enabled; there is no failure.
8. `bash scripts/pod_down.sh` (or `docker compose down`).

---

## 7. API endpoint tests (backend running, no GPU needed)

| ID | Endpoint | Expected | Status |
|---|---|---|---|
| A-1 | `GET /` | `llm_provider` and `model_id` reflect the resolved provider; `llm_connected` bool | ⏳ |
| A-2 | `GET /api/skills/learned` | `{"count":…,"skills":[…]}` 200 | ⏳ |
| A-3 | `GET /api/live/health` | `{"server_audio": false, "transport": "websocket-text"}` | ⏳ |
| A-4 | WS `/api/live/narrate` | Accepts; sends `{"type":"ready","server_audio":false}`; text frames carry `audio:false` so the browser speaks them | ✅ (bus round-trip unit-tested) |
| A-5 | `POST /api/voice/transcribe` with no file | 422/400, not 500 | ⏳ |
| A-6 | `GET /api/uitest/health` | `model` is the resolved `LLM_MODEL`, not a Gemini id | ⏳ |
| A-7 | WS `/api/uitest/stream` | Emits an `inconclusive` verdict explaining the Computer-Use driver was retired — must not throw `ImportError` | ⏳ |
| A-8 | Rate limiting | >10 req/min → 429 | ⏳ |

---

## 8. Regression / negative tests

| ID | Case | Expected | Status |
|---|---|---|---|
| R-1 | No inference endpoint at all | Backend still starts; generation raises a clear error rather than crashing on import | ✅ |
| R-2 | `LLM_PROVIDER=openai` | `ValidationError` at startup (only `amd` is allowed) | ✅ |
| R-4 | No `MONGODB_URI` | `skydb` falls back to `~/.skyrchitect/db/` local JSON | ✅ |
| R-5 | Deleted modules stay deleted | Nothing imports `gemini_client`, `gemini_live`, `minimax_client`, `computer_use_agent`, or `antigravity_client` | ✅ |
| R-6 | No retired SDKs | No `import anthropic` / `google.genai` / `google.adk` / `google.generativeai` anywhere in the tree | ✅ |

---

## 9. Known limitations / risks

- **Gemma 4 vision via Ollama** — the least-proven path. vLLM's V1 engine does not exactly reproduce Gemma 4's mixed bidirectional image attention, and ROCm multimodal has sharp edges generally. Run G-6 early; demo it last.
- **`ffmpeg` is required** for browser `audio/webm;codecs=opus` (G-8). `transformers` shells out to the binary; pip does not bundle it.
- **cloudflared quick tunnels** do not support SSE and cap at 200 concurrent requests. The narration WebSocket may misbehave over one; use ngrok (free authtoken) or demo from inside the pod.
- **10 pre-existing failures** in `project/backend/tests/test_api.py`. Verified as an identical set before and after the AMD port — not introduced by it.
- **Changing `EMBED_MODEL` invalidates the index.** Vectors from different models are not comparable. Recreate the Atlas index and re-run `scripts/migrate_vector_index.py`.

---

## 10. Quick run order

```bash
# 1. Offline — no GPU, no keys, no network                       (§2, §3)
python3 -m compileall -q project/backend deployer skydb scripts services
python3 deployer/repair_agent.py
python3 deployer/skill_library.py
cd project/backend && pytest && cd ../..

# 2. Probe the pod without starting the GPU clock                (G-1)
bash scripts/pod_up.sh --check

# 3. Bring up the GPU, verify residency                          (G-2..G-5)
bash scripts/pod_up.sh
ollama ps                      # PROCESSOR must read GPU
rocm-smi

# 4. Atlas index + re-embed                                      (L-1, L-2)
python3 scripts/migrate_vector_index.py

# 5. The demo                                                    (§6)
#    ... then stop the clock
bash scripts/pod_down.sh
```
