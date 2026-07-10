# Sky Launchpad — Compliance Report

**Event:** AMD Developer Hackathon: ACT II
**Track:** 3 — Unicorn Track (🦄)
**Last verified:** 2026-07-10

> Supersedes an earlier report written against the 2026 AI Engineer World's Fair
> (Continual Learning theme, Gemini $5k prize). That event is no longer the target.

---

## 1. Hard requirements

| Requirement | Status | Evidence |
|---|---|---|
| **All submissions must be containerized** | ✅ MET | Droplet: [`docker/docker-compose.amd.yml`](docker/docker-compose.amd.yml) (`ollama` + `whisper` + `backend`). Hackathon pod: the pod *is* a managed container; [`scripts/pod_up.sh`](scripts/pod_up.sh) runs the stack inside it. Backend image: [`Dockerfile.backend`](Dockerfile.backend). |
| **Registered before July 6, 8:00 PM CET** | ✅ MET | Confirmed by participant. |
| **Team created/joined on lablab.ai** | ✅ MET | Required even for solo entrants; the GPU pod is allocated per team. |
| **Public repository** | ⚠️ PENDING | No git remote configured. See punch list. |

## 2. Judged criteria

Track 3 is scored on *creativity, originality, completeness, **use of AMD platforms**, and product/market potential*. There is **no** speed, token, or accuracy benchmark.

### Use of AMD platforms — ✅ STRONG

AMD silicon is load-bearing for **both halves** of the self-improving loop, not a bolt-on:

| Role | Model | Where |
|---|---|---|
| Architecture generation | Gemma 3 (`gemma3:12b`) | Ollama on ROCm (MI300X) |
| Failure repair + skill authoring | Gemma 3 | Ollama on ROCm (MI300X) |
| Diagram vision (natively multimodal) | Gemma 3 | Ollama on ROCm (MI300X) |
| Skill-retrieval embeddings | mxbai-embed-large (1024-d) | Ollama on ROCm (MI300X) |
| Speech-to-text | openai/whisper-large-v3 | PyTorch-ROCm (MI300X) |

**No hosted inference anywhere in the loop.** The falsifiable claim: disable the
embedding endpoint and [`skydb.find_similar_skills`](skydb/__init__.py) degrades
from vector search to lexical cosine. Semantic recall of past failures exists
*because* of the GPU.

### Creativity / originality — ✅ STRONG
The self-improving loop: failure → Gemma 3 repair → auto-authored `SKILL.md` →
embedded on the MI300X → vector-retrieved to pre-empt recurrence. No human edits a skill.

### Completeness — ◑ PARTIAL
Code paths are wired and unit-verified offline. **Not yet exercised on real GPU
hardware.** See punch list items 3–5.

### Product / market potential — ✅ STRONG
Each failure becomes a durable, machine-readable asset owned by the customer
(plain `SKILL.md` files in their own repo). Value compounds with usage. No
per-token dependence on a frontier vendor for the part that creates the value.

## 3. "Use any open-source models and frameworks"

**Compliant — and the clause is permissive, not restrictive.** Track 3's judging
row reads *"any tech stack."* Contrast Track 1, which explicitly warns about
per-track model restrictions. Track 3 imposes none; nothing there forbids closed
models.

Our inference stack is open-weight and self-hosted regardless. We distinguish
**open weights** from **OSI open source**, because they are not the same thing:

| Component | License | Note |
|---|---|---|
| Gemma 3 (`gemma3:12b`) | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) | **Open weights, not OSI.** Gemma *code* is Apache 2.0; the *weights* are not. Gated on Hugging Face — pulling via Ollama's registry avoids the token. |
| mxbai-embed-large-v1 | Apache 2.0 | Fully OSI, not gated. |
| openai/whisper-large-v3 | Apache 2.0 | Fully OSI, not gated. |
| Ollama | MIT | Serving runtime; bundles its own ROCm build. |
| ROCm / PyTorch | MIT / BSD-3 | AMD GPU stack. |
| Terraform CLI 1.7.5 | **BUSL-1.1** | Not open source since v1.6. We invoke the CLI; we do not redistribute or resell it, so the non-compete clause does not bite. [OpenTofu](https://opentofu.org) (MPL-2.0) is a drop-in if a fully open toolchain is required. |

**One proprietary AI service remains, disclosed deliberately.**
`POST /api/infrastructure/generate` calls **GitLab Duo**
([`project/backend/duo_client.py`](project/backend/duo_client.py)), which powers the
optional GitLab-native surface ([`flows/`](flows/), [`agents/`](agents/),
[`.gitlab/duo/`](.gitlab/duo/)). It is **not on the self-improving loop**, the UI
never calls it, and the Terraform that actually gets applied comes from
[`deployer/iac_generator.py`](deployer/iac_generator.py) — pure templating, zero
LLM calls. Leave `GITLAB_TOKEN` unset and that path never executes.

## 4. Credits

Fireworks AI credits are **not required and not used**. `LLM_PROVIDER=fireworks`
remains as a one-flag escape hatch for GPU-less deployments (e.g. Cloud Run); it is
never on the critical path.

The hackathon pod (8 GPU-hrs / rolling 24h, one per team) and the $100 AMD Developer
Cloud credit are **separate, independent** allocations. The pod is not billed against
the credit.

## 5. Security

| Item | Status |
|---|---|
| Secrets in git history | ✅ NONE — `git rev-list --all --objects` finds no credential blob |
| `hackuser_accessKeys_elsa.csv` (AWS `AKIA…`) | ✅ gitignored · ⚠️ **rotate before publishing** |
| `cerebras-bot.json` (GCP SA key) | ✅ gitignored · ⚠️ **rotate** |
| `eimis-bot-hacks.json` (GCP SA key) | ✅ gitignored · ⚠️ **rotate** — was *not* ignored until 2026-07-10 |
| Secrets in container images | ✅ NONE — no `COPY` of repo root; `.dockerignore` hardened |

## 6. Scorecard

| Criterion | Status |
|---|---|
| Containerized (hard requirement) | ✅ |
| Use of AMD platforms | ✅ |
| Creativity / originality | ✅ |
| Product / market potential | ✅ |
| Open-source models & frameworks | ✅ |
| Completeness | ◑ — blocked on a real GPU run |
| Public repo | ⚠️ |
| Secrets rotated | ⚠️ |

## 7. Punch list

1. **Rotate** the AWS access key and both GCP service-account keys, then delete the local files.
2. **Push a public repo** — no git remote is configured today.
3. **Run on the pod:** `bash scripts/pod_up.sh --check`, then bring the stack up.
   Confirm `rocminfo` reports `gfx942` and `ollama ps` shows `PROCESSOR = GPU`.
4. **Create the Atlas vector index** (`numDimensions: 1024`, `path: "embedding"`,
   `similarity: cosine`), then run `python3 scripts/migrate_vector_index.py`.
5. **Record the demo:** fail a deploy on a disabled GCP API → Gemma 3 authors
   `gcp-enable-compute-api` → re-run the same requirement → the failure never occurs.
6. **Fill the DEVPOST placeholders** — repo URL, screenshots, demo video.

## 8. Known risks

- **Gemma 3 vision via Ollama** is the least-proven path. Text generation is
  well-trodden; multimodal on ROCm has sharp edges. Test diagram upload early — the
  loop does not depend on it.
- **`ffmpeg` must be present** on the pod, or browser `audio/webm;codecs=opus` will not
  decode and voice input returns 500. `pod_up.sh --check` reports this.
- **cloudflared quick tunnels** do not support SSE and cap at 200 concurrent requests.
  The narration WebSocket may misbehave over one; verify before a remote demo.
- **Pre-existing:** 10 failures in `project/backend/tests/test_api.py`, an identical set
  before and after the AMD port. Not introduced by this work.
