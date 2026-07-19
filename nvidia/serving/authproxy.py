"""Tiny auth reverse-proxy in front of the local vLLM server (:8001).

Lets the team share the self-hosted Nemotron over ONE public URL (via
cloudflared) without exposing an open GPU endpoint to the internet. Every
request must carry `Authorization: Bearer <SKY_ENDPOINT_KEY>`; the proxy checks
it, then forwards to vLLM (which is unauthenticated on localhost).

Run on the GPU box (sky-nvidia):
    SKY_ENDPOINT_KEY=sky-... \\
      ~/vllm-env/bin/uvicorn authproxy:app --host 0.0.0.0 --port 8002

Then expose :8002 publicly:
    cloudflared tunnel --url http://localhost:8002 --no-autoupdate

Both are managed as systemd units on the box (sky-proxy, sky-tunnel).
See nvidia/serving/SHARED_ENDPOINT.md.
"""
import os

import httpx
from fastapi import FastAPI, HTTPException, Request, Response

KEY = os.environ["SKY_ENDPOINT_KEY"]
UPSTREAM = os.environ.get("SKY_UPSTREAM", "http://localhost:8001")

app = FastAPI()
client = httpx.AsyncClient(base_url=UPSTREAM, timeout=300.0)


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request):
    if request.headers.get("authorization", "") != f"Bearer {KEY}":
        raise HTTPException(status_code=401, detail="invalid or missing API key")
    body = await request.body()
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in ("host", "authorization", "content-length")
    }
    headers["authorization"] = "Bearer EMPTY"  # vLLM is unauthenticated locally
    upstream = await client.request(
        request.method, "/" + path, content=body, headers=headers, params=request.query_params
    )
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )
