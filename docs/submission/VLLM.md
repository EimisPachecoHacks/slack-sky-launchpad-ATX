# Best Use of vLLM — Sky Launchpad

**How vLLM is genuinely in the loop, and the efficiency choices behind it.**

## vLLM serves the whole agent

Every architecture design, Terraform generation, and failure-diagnosis call in
the NVIDIA backend hits **one self-hosted vLLM server** we stand up on a GPU box
we control (`sky-nvidia`, an A100 80GB on Brev):

```
Slack UI → NVIDIA backend (:8020) → vLLM (:8001) serving Nemotron 3 Nano 30B-A3B
```

It's not a token mention and it's not a managed API — it's `vllm serve` running
on our hardware, exposed to the team over one authenticated endpoint. Managed
options (NVIDIA NIM cloud, hosted providers) are used only for the vision and
embedding side-paths; **all core reasoning runs on the vLLM we operate.**

## The three things judges weight

**Efficiency.** The self-healing deploy loop is a *heartbeat*: each deploy makes
repeated log-diagnosis calls, and re-optimization/optimization-advisor calls
fan out per component. vLLM's continuous batching and PagedAttention let one
A100 absorb that concurrent load — `--max-num-seqs 8`, `--gpu-memory-utilization
0.90`. Most capability per unit of compute: one box, whole agent.

**The small-model punch.** We serve **Nemotron 3 Nano 30B-A3B** — a Mixture-of-
Experts model that activates only ~3.5B parameters per token. Paired with the
agent scaffolding (skill retrieval, structured prompting, the repair loop), this
"small" model runs the entire product: design, code, diagnosis. We chose it over
brute-forcing a larger dense model that would need multiple GPUs.

**Real integration.** The build *genuinely depends* on it. If the vLLM endpoint
is down, the agent cannot design or deploy anything — there is no frontier-API
fallback. vLLM is load-bearing, not decorative.

## What it took (honest engineering)

Standing this up on an A100 with a CUDA-13 torch build meant working around a
driver mismatch: CUDA-13 forward-compat library on the r565 driver, the JIT
toolchain (`nvcc`, `ninja`, `curand` headers), and BF16 over the FP8 checkpoint
(FP8 `modelopt` needs compute capability ≥ 8.9; the A100 is 8.0). All of it is
reproducible via `nvidia/serving/start-vllm.sh` — documented in
`nvidia/serving/SERVING.md`.

## One box, both bounties

The same vLLM-served Nemotron endpoint powers the NemoClaw-contained agent
(routed via `NEMOCLAW_PROVIDER=custom`), so the vLLM infrastructure satisfies
the vLLM bounty and the Nemotron/NemoClaw bounties at once.
