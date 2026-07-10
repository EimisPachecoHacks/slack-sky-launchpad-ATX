"""OpenAI-compatible Whisper endpoint, served on the AMD MI300X.

Replaces the hosted Fireworks Whisper API so speech-to-text also runs on our own
AMD silicon. Exposes exactly the route `backend.llm_client.transcribe` calls:

    POST /v1/audio/transcriptions      (multipart: file, model, response_format)
    ->  {"text": "..."}

Run it:

    pip install fastapi uvicorn python-multipart transformers accelerate
    # plus a ROCm build of torch, and the ffmpeg BINARY (see below)
    python3 services/whisper_server.py            # binds :8100

ROCm notes:
  * ROCm PyTorch is a HIP-on-CUDA-API shim, so the device string is "cuda" and
    torch.cuda.is_available() returns True on an AMD GPU. There is no "rocm"
    device string. torch.version.hip is set when it's really an AMD build.
  * transformers decodes non-WAV audio (webm/opus from the browser) by shelling
    out to the `ffmpeg` binary. `pip install transformers` does NOT bundle it.
    Install it: apt-get install -y ffmpeg
"""

import logging
import os

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("whisper_server")

MODEL_ID = os.getenv("WHISPER_MODEL", "openai/whisper-large-v3")
PORT = int(os.getenv("WHISPER_PORT", "8100"))

app = FastAPI(title="Sky Launchpad Whisper (AMD ROCm)")

_pipe = None


def _get_pipe():
    """Load Whisper once, on first request, onto the GPU."""
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch
    from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline

    on_gpu = torch.cuda.is_available()
    device = "cuda" if on_gpu else "cpu"
    dtype = torch.float16 if on_gpu else torch.float32
    backend = f"ROCm/HIP {torch.version.hip}" if getattr(torch.version, "hip", None) else device
    logger.info("loading %s on %s (%s)", MODEL_ID, device, backend)

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        MODEL_ID, torch_dtype=dtype, low_cpu_mem_usage=True, use_safetensors=True
    ).to(device)
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    _pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=dtype,
        device=device,
        chunk_length_s=30,   # whisper's native window; enables long-audio chunking
        batch_size=16,
    )
    logger.info("whisper ready")
    return _pipe


@app.get("/health")
def health() -> dict:
    import torch

    return {
        "model": MODEL_ID,
        "loaded": _pipe is not None,
        "gpu": torch.cuda.is_available(),
        "hip": getattr(torch.version, "hip", None),
    }


@app.post("/v1/audio/transcriptions")
async def transcriptions(
    file: UploadFile = File(...),
    model: str = Form(default=MODEL_ID),
    response_format: str = Form(default="json"),
) -> dict:
    """OpenAI-compatible transcription. `model` and `response_format` are accepted
    for wire compatibility; this server always serves WHISPER_MODEL as JSON."""
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio upload")

    try:
        result = _get_pipe()(audio)
    except FileNotFoundError as exc:  # ffmpeg missing -> compressed audio can't decode
        raise HTTPException(
            status_code=500,
            detail=f"ffmpeg is required to decode {file.content_type}: {exc}",
        ) from exc
    except Exception as exc:
        logger.exception("transcription failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"text": (result.get("text") or "").strip()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
