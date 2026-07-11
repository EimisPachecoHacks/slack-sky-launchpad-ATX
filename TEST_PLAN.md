# Sky Launchpad — Test Plan

**Project:** Sky Launchpad (self-improving cloud-infrastructure autopilot agent)
**Scope:** the self-improving loop, the Qwen Cloud inference stack, Alibaba Cloud deploys, and the surrounding app.

Legend: ✅ verified · ⏳ ready to run · 🔑 needs live cloud creds · 🗝️ needs `DASHSCOPE_API_KEY` · 👤 manual/UI

---

## 1. Test environment

| Item | Value |
|---|---|
| Backend | FastAPI + uvicorn, `http://localhost:8080` |
| Frontend | Vite dev server, `http://localhost:3001` (proxies `/api` → backend) |
| Inference | **Qwen Cloud** — `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (`qwen3.7-max`, `qwen3.7-plus`, `text-embedding-v4`, `qwen3-asr-flash`) |
| CLI / loop | `deployer/` package (run from repo root) |
| Keys needed | `DASHSCOPE_API_KEY` for inference; `MONGODB_URI` for Atlas; `GITLAB_TOKEN` for MRs; Alibaba Cloud RAM AccessKey for real deploys |

**Setup**
```bash
cd project && cp .env.example .env    # set DASHSCOPE_API_KEY
pip install -r backend/requirements.txt
uvicorn backend.api.main:app --host 0.0.0.0 --port 8080
```

**Exit criteria:** all offline tests pass; the demo flow (§5) runs end to end and the *second* run of the same requirement does not fail.

---

## 2. Unit / smoke tests (offline — no keys, no network)

| ID | Component | Command | Expected | Status |
|---|---|---|---|---|
| U-1 | Repair agent | `python3 deployer/repair_agent.py` | Returns `fixed_files`, `new_skill.markdown`; unparseable model output still yields a synthesized skill | ✅ |
| U-2 | Skill library (save + retrieve) | `python3 deployer/skill_library.py` | Relevant skill ranks first for a matching error; real `skills/learned/` untouched | ✅ |
| U-3 | Everything compiles | `python3 -m compileall -q project/backend deployer skydb scripts` | Exit 0 | ✅ |
| U-4 | App imports, routes intact | `cd project && python3 -c "import sys;sys.path.insert(0,'.');from backend.api.main import app;print(len(app.routes))"` | prints a route count | ✅ |
| U-5 | Backend pytest suite | `cd project/backend && pytest -q` | **92 passed, 11 skipped** (real-API tests skip without a key), 1 pre-existing deploy failure (needs live cloud creds) | ✅ |
| U-6 | Retrieval degrades without embeddings | run retrieval with no reachable embedding endpoint | Logs `embed() failed …; retrieval will fall back to lexical`; still returns a scored hit | ✅ |
| U-7 | alicloud Terraform generates | `python3 -c "import sys;sys.path.insert(0,'.');from deployer.iac_generator import generate_alicloud_terraform as g;print(list(g().keys()))"` | 5 files incl. `main.tf` with `alicloud_oss_bucket`/`alicloud_vpc` | ✅ |

---

## 3. Inference-client contract tests

| ID | Surface | Expected | Status |
|---|---|---|---|
| C-1 | `chat()` | `POST {LLM_BASE_URL}/chat/completions`, `Authorization: Bearer {DASHSCOPE_API_KEY}`, parses `choices[0].message.content` | ✅ |
| C-2 | `vision_chat()` | Standard OpenAI multimodal content array with an `image_url` `data:` URI to `qwen3.7-plus` | ✅ |
| C-3 | `transcribe()` | `multipart/form-data` to `{LLM_AUDIO_BASE_URL or LLM_BASE_URL}/audio/transcriptions`, model `qwen3-asr-flash` | ✅ |
| C-4 | `embed()` | Payload `{model:"text-embedding-v4", input, dimensions:1024}`; width guard rejects a mismatched vector | ✅ |
| C-5 | Model resolution | `LLM_PROVIDER=qwen` → `qwen3.7-max`; explicit `LLM_MODEL` overrides | ✅ |

---

## 4. Live Qwen Cloud tests 🗝️

| ID | Check | Command | Expected |
|---|---|---|---|
| Q-1 | Chat | `curl .../chat/completions -d '{"model":"qwen3.7-max",...}'` | 200, non-empty content |
| Q-2 | Vision | Upload a diagram via the UI | Structured JSON with provider + components |
| Q-3 | Embedding width | `curl .../embeddings -d '{"model":"text-embedding-v4","input":"...","dimensions":1024}'` | `data[0].embedding` length **1024** |
| Q-4 | Voice | Record via the mic button | Transcript returned |

---

## 5. Self-improving loop + demo flow 🔑🗝️👤

| ID | Step | Expected |
|---|---|---|
| L-1 | Atlas index | Vector index on `skills`: `numDimensions: 1024`, `path: "embedding"`, `similarity: cosine` |
| L-2 | Failure → repair | Deploy an `alicloud` config that fails (e.g. unsupported instance type). `qwen3.7-max` diagnoses and rewrites the HCL |
| L-3 | Repair → skill | `skills/learned/<slug>/SKILL.md` appears; index gains a repo-relative `path` + 1024-d `embedding` |
| L-4 | **Transfer (the money shot)** | Re-run the *same* requirement. The learned skill is retrieved and injected; **the failure does not recur** |
| L-5 | Reuse counted | `GET /api/skills/learned` shows `hit_count > 0` for the retrieved skill |

**Demo order:** describe a need → `qwen3.7-max` generates → deploy fails on Alibaba Cloud → narration streams `failure → diagnose → learned → retry` → retry succeeds (+ optional GitLab MR) → re-run identical requirement → no failure.

---

## 6. API endpoint tests (backend running)

| ID | Endpoint | Expected | Status |
|---|---|---|---|
| A-1 | `GET /` | `{"status":"ok",...}` | ⏳ |
| A-2 | `GET /api/skills/learned` | `{"count":…,"skills":[…]}` 200 | ⏳ |
| A-3 | `POST /api/architecture/analyze-image` | provider + components JSON (needs key) | 🗝️ |
| A-4 | `POST /api/code/generate` (no key) | Clean 500 "Qwen Cloud could not be reached", not raw stderr | ✅ |
| A-5 | `POST /api/voice/transcribe` with no file | 400/422, not 500 | ⏳ |
| A-6 | `DELETE /api/apps/{id}` | sample→400, unknown→404, real→removes app+cases+runs | ✅ |
| A-7 | Rate limiting | >N req/min → 429 | ⏳ |

---

## 7. Regression / negative tests

| ID | Case | Expected | Status |
|---|---|---|---|
| R-1 | No `DASHSCOPE_API_KEY` | Backend starts; generation raises a clear error, not a crash | ✅ |
| R-2 | `LLM_PROVIDER=openai` | `ValidationError` at startup (only `qwen` allowed) | ✅ |
| R-3 | No `MONGODB_URI` | `skydb` falls back to `~/.skyrchitect/db/` local JSON | ✅ |
| R-4 | Deleted modules stay deleted | Nothing imports `duo_client`, `whisper_server`, or the old AMD/Gemini/Fireworks modules | ✅ |
| R-5 | Changing `EMBED_MODEL` invalidates the index | Recreate the Atlas index and re-run `scripts/migrate_vector_index.py` | ⚠️ documented |
