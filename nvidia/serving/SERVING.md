# vLLM serving on `sky-nvidia` (A100 80GB, Brev/Crusoe)

Nemotron 3 Nano 30B-A3B (BF16) served by vLLM on `:8001`. Launch with
[`start-vllm.sh`](start-vllm.sh) (run on the box). The public/shared access
layer is documented in [SHARED_ENDPOINT.md](SHARED_ENDPOINT.md).

## Why the non-obvious env vars

Getting vLLM up on this box took working around a stack mismatch — recorded here
so a restart doesn't repeat the debugging:

- **`LD_LIBRARY_PATH=/usr/local/cuda-13.1/compat`** — the box ships NVIDIA driver
  r565 (CUDA 12.7), but vLLM's torch is a CUDA-13 build. The CUDA-13 *forward-
  compatibility* library lets the new toolkit run on the older driver without a
  risky driver replacement. (13.1 works; 13.2/13.3 compat were too new for r565.)
- **`CUDA_HOME` + `nvcc` on `PATH`** — vLLM JIT-compiles sampler kernels at
  startup; it needs a matching `nvcc` (`cuda-nvcc-13-1`), `ninja` (`ninja-build`),
  and CUDA dev headers (`libcurand-dev-13-1`, `cuda-cccl-13-1`, `cuda-cudart-dev-13-1`).
- **`VLLM_USE_FLASHINFER_SAMPLER=0`** — belt-and-suspenders: skips the FlashInfer
  sampler JIT path (the one that needed `curand.h`) in case a header is missing.
- **BF16, not FP8** — the published FP8 checkpoint uses the `modelopt` quant
  method, which needs compute capability ≥ 8.9; the A100 is 8.0. BF16 runs fine
  and fits in 80 GB at `--gpu-memory-utilization 0.90`.

## One-time box setup (already done on sky-nvidia)

```bash
sudo apt-get install -y python3-venv ninja-build \
  cuda-nvcc-13-1 libcurand-dev-13-1 cuda-cccl-13-1 cuda-cudart-dev-13-1 \
  cuda-compat-13-1
python3 -m venv ~/vllm-env && ~/vllm-env/bin/pip install -U vllm "huggingface_hub[cli]"
HF_TOKEN=hf_... ~/vllm-env/bin/hf download nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16
```

## Health

```bash
sudo systemctl status vllm-nano
curl -s localhost:8001/v1/models | grep -q Nemotron && echo serving
```
