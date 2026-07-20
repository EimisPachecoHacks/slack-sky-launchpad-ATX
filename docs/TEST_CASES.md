# Sky Launchpad — Test Cases (manual reproduction guide)

Every case below was run end-to-end this session against **Qwen models on Qwen
Cloud** with the backend on **Alibaba Cloud ECS**. Screenshots are the actual
evidence captured during those runs, saved under
[`docs/testing/screenshots/`](testing/screenshots/). Follow the steps to
reproduce each yourself.

---

## Prerequisites

| Thing | How |
|---|---|
| Slack bot running | `cd slack && node app.js` (Socket Mode). It points at `SKY_API_URL` in `slack/.env`. |
| Backend | Alibaba Cloud ECS: `http://47.84.111.187:8080` (or local: `cd project && ./venv/bin/python -m uvicorn backend.api.main:app --port 8000`). |
| Backend health check | `curl http://47.84.111.187:8080/api/status` → should show `llm_provider: qwen`, `model_id: qwen3.7-max`. |
| For the UI-tester case | A live web app to test. Start the bundled testbed: `./project/venv/bin/python testbed/app/app.py 8090` → `http://localhost:8090`. |
| Self-healing demo | Backend env `SKY_DEMO_FAULT=1` (single fault) or `SKY_DEMO_FAULT=2` (two-stage → forces web-research escalation). Unset for a clean first-try deploy. |

> The exact demo inputs used throughout: **provider** Alibaba Cloud · **title**
> `Online store` · **description** `An online store with a product catalog, image
> storage, and a database.`

---

# Part 1 — Slack (primary UX)

## TC-1 — Generate architecture from a description
**Steps**
1. In a channel, `@Sky Launchpad` then click **Guided Wizard** (or `/sky new`).
2. **Start** → choose **Alibaba Cloud**.
3. Title `Online store`, description as above → **Generate Architecture**.
4. Wait ~60–110s (`qwen3.7-max`).

**Expected** — a review card appears with the component table (name · type ·
$/mo), a **Total Monthly Cost**, action buttons (Generate Code / AI Reasoning /
Deploy), and a GitLab issue link.

**Evidence** — [`tc1-review-card.png`](testing/screenshots/slack/tc1-review-card.png) ✅

---

## TC-2 — Cost / Performance tabs are pure view toggles
**Steps**
1. On the review card, switch between **Cost Optimized** and **Performance Optimized**.

**Expected** — the projection updates **instantly** (no regeneration, no new
architecture). Each component row shows the cost- vs performance-optimized
alternative, and the **Total Monthly Cost changes with the tab**. ✅ verified —
switching does not call the model.

---

## TC-3 — Swap a single component
**Steps**
1. On any component row, open the **Switch** dropdown and pick a cheaper/faster
   alternative (or **Restore default**).

**Expected** — only that component changes; the total and the diagram update; a
confirmation line is posted. No full regeneration. ✅

---

## TC-4 — Architecture diagram in the channel
**Expected** — a few seconds after the review card, an illustrated diagram
(`architecture-diagram.jpg`, drawn by Gemini/“Nano Banana”, styled to the
provider) is posted **directly in the channel** — titled with the project name,
every component labeled with its cost, arrows between them.

**Evidence** — [`tc4-diagram-in-channel.png`](testing/screenshots/slack/tc4-diagram-in-channel.png) ✅

---

## TC-5 — Generate Terraform
**Steps**
1. On the review card, click **Generate Code**. Wait ~100s.

**Expected** — an *Infrastructure Code* message with a **Terraform** snippet
(real `alicloud` HCL — providers, VPC, VSwitch, security group, etc.), a model
footer (`qwen3.7-max`), and a **🚀 Deploy** button.

**Evidence** — [`tc5-terraform-code.png`](testing/screenshots/slack/tc5-terraform-code.png) ✅

---

## TC-6 — AI Image Analysis (diagram → architecture)
**Steps**
1. DM the bot a PNG/JPG/PDF of an architecture diagram (≤10 MB), or **AI Image
   Analysis** from the wizard.

**Expected** — `qwen3.7-plus` (vision) detects the components and rebuilds the
architecture, then the same review → code → deploy flow applies. ✅ verified via
API: 6 components detected (confidence 99) with names, categories, costs.

---

## TC-7 — Deploy with self-healing (fail → learn → retry → succeed)
*Backend env `SKY_DEMO_FAULT=1`.*

**Steps**
1. On the code message, click **🚀 Deploy**.
2. In the modal: account + region are pre-filled; tick the **confirmation**
   checkbox; click **🚀 Deploy**.
3. Watch the progress message (~3–5 min).

**Expected arc**
- Attempt 1 fails on an injected invalid argument.
- `qwen3.7-max` diagnoses it and **authors a learned skill**.
- Attempt 2 **succeeds**; a real VPC is created.
- A **GitLab merge request** is opened (Autopilot Stage 3); test resources are
  destroyed.
- Success card shows: **“🧠 Self-healing loop: succeeded on attempt 2 · learned
  skill: terraform-unsupported-argument”**.

**Evidence** — deploy modal [`tc8-deploy-modal-confirm.png`](testing/screenshots/slack/tc8-deploy-modal-confirm.png) ·
progress [`tc7-deploy-self-heal-progress.png`](testing/screenshots/slack/tc7-deploy-self-heal-progress.png) ·
success + GitLab MR [`tc7-deploy-self-heal-success.png`](testing/screenshots/slack/tc7-deploy-self-heal-success.png) ✅

---

## TC-8 — Deploy with web-research escalation (fail → learn → fail → 🔎 research → update skill → succeed)
*Backend env `SKY_DEMO_FAULT=2` (two faults: an invalid argument **and** a
VSwitch CIDR the Alibaba API rejects at apply — so the first fix isn’t enough).*

**Steps** — same as TC-7. Runs longer (~6–8 min: two repair cycles).

**Expected arc**
- Attempt 1 fails (invalid argument) → learns `alicloud-unsupported-argument`.
- Attempt 2 fails at apply (Alibaba rejects the CIDR) → **escalates**:
  🔎 investigates the error on the **live Internet** (Qwen web search) → authors
  an **updated** skill `alicloud-vswitch-cidr-subnet-validation`.
- Attempt 3 **succeeds**; both skills saved to `skills/learned/`; **GitLab MR**
  opened; resources destroyed.
- Success card shows: **“🧠 Self-healing loop: succeeded on attempt 3 · 🔎
  researched the failure on the web · learned skills: alicloud-unsupported-argument,
  alicloud-vswitch-cidr-subnet-validation”**.

**What each of your requirements maps to in the deploy log**
| Requirement | Log line |
|---|---|
| how many tries | `Attempt 1/3 … 2/3 … 3/3` |
| checked the logs | `[diagnose] Handing the logs to the Qwen repair agent…` |
| went to the Internet | `[RESEARCH] … investigating the error on the web (Qwen search)` |
| skill updated | `[LEARN] Updated skill: <slug>` (vs `Learned skill:` first time) |
| succeeded | `[SUCCESS] Infrastructure deployed on attempt 3!` |
| skill saved to DB | `skills/learned/<slug>/SKILL.md` + vector index |
| code saved to git | `[AUTOPILOT STAGE 3] Code saved to GitLab: …/merge_requests/N` |

**Evidence** — confirm modal [`tc8-deploy-modal-confirm.png`](testing/screenshots/slack/tc8-deploy-modal-confirm.png) ·
progress [`tc8-escalation-progress.png`](testing/screenshots/slack/tc8-escalation-progress.png) ·
success + GitLab MR [`tc8-escalation-success.png`](testing/screenshots/slack/tc8-escalation-success.png) ✅

---

## TC-9 — UI Tester: test a live app, screenshot bugs, learn skills
**Steps**
1. Start the testbed: `./project/venv/bin/python testbed/app/app.py 8090`.
2. In Slack: `/sky test http://localhost:8090` (or the **🧪 Test this app**
   button on a deploy card that has an app endpoint).
3. Wait ~3–4 min.

**Expected** — `qwen3.7-max` plans test cases, drives the app in a real browser,
screenshots each step, posts a **results card** (✅ passed / 🐛 failed / ❓
inconclusive with reasons), uploads each case’s final screenshot into the
thread, and turns each bug into a **learned skill**.

**Result from the verified run** — 4 cases: **2 passed, 2 real bugs found**:
- 🐛 signup form accepts empty email/password (only validates `name`)
- 🐛 delete removes the **wrong** todo (asked for Task B, deleted Task A)

**Evidence**
- Slack results card [`tc9-tester-results-card.png`](testing/screenshots/slack/tc9-tester-results-card.png)
- Slack thread with bug screenshots [`tc9-tester-thread-shots.png`](testing/screenshots/slack/tc9-tester-thread-shots.png)
- The bug images the agent captured:
  - signup before [`tc9-01`](testing/screenshots/tester/tc9-01-signup-empty-before.png) → empty-submit **BUG** [`tc9-02`](testing/screenshots/tester/tc9-02-signup-empty-BUG.png)
  - signup success **PASS** [`tc9-03`](testing/screenshots/tester/tc9-03-signup-success-PASS.png)
  - todo before delete [`tc9-04`](testing/screenshots/tester/tc9-04-todo-list-before-delete.png) → deleted wrong item **BUG** [`tc9-05`](testing/screenshots/tester/tc9-05-todo-delete-wrong-BUG.png)

✅ verified end-to-end in Slack.

---

# Part 2 — Website (same flow)

The web app under [`project/`](../project/) shares the same backend, so it runs
the same design → code → deploy → self-heal flow.

**Run it locally**
```bash
# backend (open dev mode, has demo faults + credentials)
cd project && SKY_DEMO_FAULT=2 ./venv/bin/python -m uvicorn backend.api.main:app --port 8000
# frontend
cd project && npm install
VITE_API_URL=http://localhost:8000 npm run dev   # http://localhost:5173
```
To skip the sign-in screen, set a demo user in the browser console then reload:
```js
localStorage.setItem('demoUser', JSON.stringify({id:'demo',email:'demo@skyrchitect.com',name:'Demo User'}))
```

The website is a **5-step wizard** (Provider → Use Case → Review → Code →
Deploy), plus top-nav views the Slack app doesn't have: **Dashboard**,
**Deployed Apps**, **How It Learned** (the learned-skills view), and **UI
Self-Test** (the tester).

### W-1 — Landing / dashboard
Click **Create New Architecture**.
[`w1-landing.png`](testing/screenshots/web/w1-landing.png) ✅

### W-2 — Provider (step 2)
**Guided Wizard** → pick **Alibaba Cloud**.
[`w2-provider-select.png`](testing/screenshots/web/w2-provider-select.png) ✅

### W-3 — Use Case (step 3)
Project Title `Online store`, Project Description as above → **Generate
Architecture**. [`w3-usecase-filled.png`](testing/screenshots/web/w3-usecase-filled.png) ✅

### W-4 — Review (step 4) — generated architecture
`qwen3.7-max` returns the architecture, rendered as a **live diagram canvas**
(ALB → ECS → OSS/RDS with connections) plus a **components table**: Total
Monthly Cost **$110.50**, **Cost Optimized / Performance Optimized** toggle,
per-component **Switch** and **Details**.
[`w4-review-architecture.png`](testing/screenshots/web/w4-review-architecture.png) ✅ **verified**

### W-5 — Code (step 5) — Terraform
**Generate Code** → *“Qwen is generating your terraform code… Automatic retry on
failure (up to 3 attempts).”*
[`w5-terraform-code.png`](testing/screenshots/web/w5-terraform-code.png) ✅ **verified**

### W-6 — Deploy (config page)
**Proceed to Deployment** opens the deploy config: Cloud Account, Region, GitHub
repo, and the “I understand this runs real Terraform” confirmation.
[`w6-deploy-page.png`](testing/screenshots/web/w6-deploy-page.png)

> **Known limitation (web deploy only).** In this demo run the web deploy form’s
> **Cloud Account** picker did not populate, so the **Deploy** button stayed
> disabled. The backend `/api/credentials/list` returns the server-stored
> Alibaba account correctly (verified: an in-browser `fetch` returns 3 accounts
> incl. `alicloud`), so this is a **front-end state timing bug** in
> `DeploymentForm.tsx` (`availableAccounts` not populating from the successful
> fetch; button gate at line 240: `availableAccounts.length === 0 || !deployConfirmed`),
> **not** a backend or credentials problem. The deploy **engine is identical**
> to the one the Slack app calls (`POST /api/deploy`, same self-healing +
> web-research loop), which is fully proven in **TC-7 / TC-8** above. **Use Slack
> for the live deploy demo;** fixing the web deploy-form account picker is a
> known follow-up.

### W-7 — AI Image Analysis (diagram image → architecture)
The website's second entry path. On the create page choose **AI Image
Analysis** → drop in a diagram (PNG/JPG/PDF ≤10 MB).

**Steps**
1. `/architecture` → **AI Image Analysis**.
2. Drop/choose an architecture diagram image.
3. Wait ~75s (`qwen3.7-plus` vision).

**Expected** — *“Analyzing your architecture diagram…”*, then the detected
architecture renders exactly like the description flow: provider + component
count, the **diagram canvas**, and the **components table** (with per-component
confidence), then **Generate Code**.

**Result (verified)** — uploaded a 6-box “Online store” diagram → backend:
`🖼️ Analyzing via qwen3.7-plus` → `✓ Parsed: ALIBABA, 6 components, $290/mo` →
`✅ Image analysis completed`. The site rendered all 6 (CDN, ALB, ECS, OSS,
ApsaraDB Redis, ApsaraDB RDS) at **99% confidence**, Total **$290/mo**.

**Evidence** — upload view [`w7-image-upload.png`](testing/screenshots/web/w7-image-upload.png) ·
analyzing [`w7-image-analyzing.png`](testing/screenshots/web/w7-image-analyzing.png) ·
detected architecture [`w7-image-detected.png`](testing/screenshots/web/w7-image-detected.png) ✅

---

**Summary:** the website reproduces **both** entry paths end-to-end on Qwen —
the **Guided Wizard** (W-1…W-5) and **AI Image Analysis** (W-7) — through
design → diagram → cost tabs → Terraform, and reaches the deploy step (W-6). The
actual deploy is demonstrated via Slack (TC-7/TC-8), which shares the same
backend.
