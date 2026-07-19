# Shared Nemotron endpoint (self-hosted vLLM, one public URL for the whole team)

The NVIDIA backend reasons/generates on a **self-hosted Nemotron 3 Nano 30B**
served by **vLLM** on the GPU box `sky-nvidia` (Brev A100 80GB). To let every
teammate use it **without Brev CLI or a personal port-forward**, the box exposes
vLLM through one authenticated public URL:

```
cloudflared tunnel  ──►  :8002 auth proxy (authproxy.py, checks Bearer key)  ──►  :8001 vLLM (Nemotron)
```

## Use it (any machine, no Brev access needed)

Put these in `nvidia/.env` (get the current URL + key from a teammate who has the
box — they are NOT committed, since the URL rotates and the key is a secret):

```
LLM_PROVIDER=nemotron
LLM_BASE_URL=https://<current>.trycloudflare.com/v1
LLM_MODEL=nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16
LLM_API_KEY=sky-<the shared key>
```

Vision + embeddings still go to the NVIDIA NIM API (`NVIDIA_API_KEY`); only
text/reasoning uses the shared vLLM.

## On the box (how it's wired)

Three systemd units (all `Restart=on-failure`):

| Unit | What |
|---|---|
| `vllm-nano` | vLLM serving Nemotron 30B on `:8001` (see [SERVING.md](SERVING.md)) |
| `sky-proxy` | `authproxy.py` on `:8002` — requires `Authorization: Bearer $SKY_ENDPOINT_KEY` |
| `sky-tunnel` | `cloudflared tunnel --url http://localhost:8002` — the public URL |

Start the proxy:
```bash
SKY_ENDPOINT_KEY=sky-... \
  ~/vllm-env/bin/uvicorn authproxy:app --host 0.0.0.0 --port 8002
```

## Caveats

- **The trycloudflare URL rotates** whenever `sky-tunnel` restarts. Fetch the
  current one:
  ```bash
  brev exec sky-nvidia -- "sudo journalctl -u sky-tunnel -o cat | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1"
  ```
  For a stable domain, swap cloudflared for a named tunnel or ngrok with a
  reserved domain.
- **One GPU, shared load** — fine for dev + demo; heavy parallel use competes.
- **The API key gates the GPU** — don't commit it or post it publicly; rotate by
  restarting `sky-proxy` with a new `SKY_ENDPOINT_KEY` and updating each `.env`.
