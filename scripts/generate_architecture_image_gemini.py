#!/usr/bin/env python3
"""One-off: generate Skyrchitect system architecture image via Gemini image API."""
import base64
import json
import os
import sys

import requests

MODEL = os.environ.get("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview")
API_KEY = os.environ.get("GEMINI_API_KEY", "")
OUT_PATH = os.environ.get(
    "GEMINI_IMAGE_OUT",
    os.path.join(os.path.dirname(__file__), "..", "project", "public", "skyrchitect-system-architecture-gemini.png"),
)

PROMPT = """Create a single professional system architecture diagram image (16:9 landscape), clean tech style,
white or very light background, readable labels, subtle shadows, no photorealistic people.

Title at top: "Skyrchitect — system architecture"

Show these components and data flows with arrows:

1) "User / Browser" with React SPA (Vite).
2) "Google Cloud Run" box containing two layers: "nginx" (static React + reverse proxy /api) and "FastAPI (Python)".
3) "GitLab Duo" cloud: label "Duo Chat (GraphQL) + optional glab CLI" — arrows from FastAPI to GitLab Duo for architecture + IaC reasoning.
4) Small side note: "Anthropic Claude" only for image-to-text vision step feeding Duo (optional small dashed arrow).
5) "GitLab.com" for MR/commits when validation succeeds — arrow from FastAPI.
6) "deployer module" inside or beside FastAPI: "Terraform apply" to target clouds.
7) Two target clouds side by side: "AWS" and "GCP" (and small "Azure" optional) as deployment targets with generic icons (VPC, bucket, compute), not vendor logos if unclear.
8) "Encrypted credential store" on the FastAPI side.

Use consistent colors: GCP accent for Cloud Run, neutral for app, purple/indigo hint for GitLab.

No tiny unreadable text; short labels only."""


def main() -> int:
    if not API_KEY:
        print("Set GEMINI_API_KEY", file=sys.stderr)
        return 1
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={API_KEY}"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": PROMPT}],
            }
        ],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {"aspectRatio": "16:9", "imageSize": "2K"},
        },
    }
    r = requests.post(url, json=body, timeout=300)
    try:
        data = r.json()
    except json.JSONDecodeError:
        print(r.text[:2000], file=sys.stderr)
        return 1
    if r.status_code != 200:
        print(r.text[:4000], file=sys.stderr)
        return 1

    if "error" in data:
        print(json.dumps(data["error"], indent=2), file=sys.stderr)
        return 1

    candidates = data.get("candidates") or []
    if not candidates:
        print("No candidates in response:", json.dumps(data)[:2000], file=sys.stderr)
        return 1

    parts = (candidates[0].get("content") or {}).get("parts") or []
    image_bytes = None
    mime = "image/png"
    for p in parts:
        inline = p.get("inlineData") or p.get("inline_data")
        if inline and inline.get("data"):
            image_bytes = base64.b64decode(inline["data"])
            mime = inline.get("mimeType") or inline.get("mime_type") or mime
            break

    if not image_bytes:
        print("No image in response. Parts:", json.dumps(parts)[:2000], file=sys.stderr)
        return 1

    ext = ".png" if "png" in mime else ".jpg" if "jpeg" in mime else ".bin"
    out = OUT_PATH
    if out.endswith(".png") and ext != ".png":
        out = out.rsplit(".", 1)[0] + ext
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "wb") as f:
        f.write(image_bytes)
    print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
