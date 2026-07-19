#!/bin/bash
# Start (or restart) Nemotron 3 Nano 30B on vLLM on the GPU box `sky-nvidia`.
# Run ON the box. Encodes the exact env that got vLLM working on an A100 80GB
# with the r565 driver + CUDA-13 torch build (see SERVING.md for the why).
set -euo pipefail

MODEL="nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16"

sudo systemctl stop vllm-nano 2>/dev/null || true
sudo systemctl reset-failed vllm-nano 2>/dev/null || true
sudo systemd-run --unit=vllm-nano -p User=ubuntu -p Restart=on-failure \
  -E HF_HOME=/home/ubuntu/.cache/huggingface \
  -E LD_LIBRARY_PATH=/usr/local/cuda-13.1/compat \
  -E CUDA_HOME=/usr/local/cuda-13.1 \
  -E PATH=/home/ubuntu/vllm-env/bin:/usr/local/cuda-13.1/bin:/usr/bin:/bin:/usr/local/bin \
  -E VLLM_USE_FLASHINFER_SAMPLER=0 \
  /home/ubuntu/vllm-env/bin/vllm serve "$MODEL" \
    --host 0.0.0.0 --port 8001 \
    --gpu-memory-utilization 0.90 --max-num-seqs 8

echo "vllm-nano starting; watch: sudo journalctl -u vllm-nano -f"
echo "ready when: curl -s localhost:8001/v1/models | grep -q Nemotron"
