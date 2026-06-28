"""Local (and best-effort Cloud Run) redeploy helper for "Sky Launchpad".

Phase 2 of the self-healing loop: after the fix agent writes new frontend source
and opens an MR, this validates the change locally by running a frontend build.

- ``local`` mode (default): runs ``npm --prefix <repo>/project run build`` from the
  repo root. The Vite dev server hot-reloads on file change, so a successful build
  is a validation step that the fix compiles/type-checks cleanly.
- ``cloudrun`` mode: best-effort ``gcloud builds submit`` + ``gcloud run deploy`` if
  ``gcloud`` is on PATH; otherwise returns ok=False with a clear note.

``redeploy`` never raises: subprocess failures and timeouts are captured into the
returned dict. All subprocess calls are bounded by timeouts so we never hang.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_MODE = "local"
LOCAL_URL = "http://localhost:3001"

# Timeouts (seconds), overridable via env.
BUILD_TIMEOUT = int(os.getenv("REDEPLOY_BUILD_TIMEOUT", "300"))
GCLOUD_BUILD_TIMEOUT = int(os.getenv("REDEPLOY_GCLOUD_BUILD_TIMEOUT", "600"))
GCLOUD_DEPLOY_TIMEOUT = int(os.getenv("REDEPLOY_GCLOUD_DEPLOY_TIMEOUT", "600"))

_TAIL_CHARS = 4000  # how much stdout/stderr tail to keep


def _repo_root() -> str:
    """Repo root = three levels up from this file (.../self-improve-llm).

    project/backend/uitest/redeploy.py -> repo root contains the ``project`` dir.
    Overridable via REDEPLOY_REPO_ROOT.
    """
    env_root = os.getenv("REDEPLOY_REPO_ROOT")
    if env_root:
        return os.path.realpath(env_root)
    here = os.path.dirname(os.path.realpath(__file__))
    # uitest -> backend -> project -> repo_root
    return os.path.realpath(os.path.join(here, "..", "..", ".."))


def _tail(text: Optional[str]) -> str:
    if not text:
        return ""
    text = text.strip()
    if len(text) <= _TAIL_CHARS:
        return text
    return "...(truncated)...\n" + text[-_TAIL_CHARS:]


def _run(cmd: List[str], cwd: str, timeout: int) -> Dict[str, Any]:
    """Run a subprocess with a hard timeout. Never raises."""
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "returncode": proc.returncode,
            "stdout": _tail(proc.stdout),
            "stderr": _tail(proc.stderr),
            "timed_out": False,
        }
    except subprocess.TimeoutExpired as e:
        return {
            "returncode": None,
            "stdout": _tail(e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout),
            "stderr": _tail(e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr),
            "timed_out": True,
        }
    except FileNotFoundError as e:
        return {"returncode": None, "stdout": "", "stderr": str(e), "timed_out": False, "missing": True}
    except Exception as e:  # noqa: BLE001
        return {"returncode": None, "stdout": "", "stderr": str(e), "timed_out": False}


def _redeploy_local() -> Dict[str, Any]:
    repo = _repo_root()
    project_dir = os.path.join(repo, "project")

    if shutil.which("npm") is None:
        return {
            "ok": False,
            "mode": "local",
            "detail": "npm not found on PATH; cannot run frontend build.",
            "url": LOCAL_URL,
        }
    if not os.path.isdir(project_dir):
        return {
            "ok": False,
            "mode": "local",
            "detail": f"project dir not found at {project_dir}",
            "url": LOCAL_URL,
        }

    res = _run(["npm", "--prefix", project_dir, "run", "build"], cwd=repo, timeout=BUILD_TIMEOUT)

    if res.get("timed_out"):
        return {
            "ok": False,
            "mode": "local",
            "detail": f"build timed out after {BUILD_TIMEOUT}s",
            "stderr": res.get("stderr", ""),
            "url": LOCAL_URL,
        }

    ok = res.get("returncode") == 0
    detail = (
        "frontend build succeeded; Vite dev server hot-reloads the change."
        if ok
        else f"frontend build failed (exit {res.get('returncode')})."
    )
    return {
        "ok": ok,
        "mode": "local",
        "detail": detail,
        "stdout": res.get("stdout", ""),
        "stderr": res.get("stderr", ""),
        "url": LOCAL_URL,
    }


def _redeploy_cloudrun() -> Dict[str, Any]:
    out: Dict[str, Any] = {"ok": False, "mode": "cloudrun", "detail": "", "url": ""}

    if shutil.which("gcloud") is None:
        out["detail"] = "gcloud CLI not found on PATH; cannot deploy to Cloud Run."
        return out

    repo = _repo_root()
    project_dir = os.path.join(repo, "project")
    service = os.getenv("CLOUDRUN_SERVICE", "sky-launchpad")
    region = os.getenv("CLOUDRUN_REGION", "us-central1")
    gcp_project = os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    image = os.getenv("CLOUDRUN_IMAGE") or (
        f"gcr.io/{gcp_project}/{service}" if gcp_project else None
    )

    if not gcp_project:
        out["detail"] = "GCP_PROJECT / GOOGLE_CLOUD_PROJECT not set; cannot submit a build."
        return out
    if not image:
        out["detail"] = "could not determine container image name."
        return out

    build_res = _run(
        ["gcloud", "builds", "submit", "--tag", image, "--project", gcp_project, project_dir],
        cwd=repo,
        timeout=GCLOUD_BUILD_TIMEOUT,
    )
    if build_res.get("timed_out"):
        out["detail"] = f"gcloud builds submit timed out after {GCLOUD_BUILD_TIMEOUT}s"
        out["stderr"] = build_res.get("stderr", "")
        return out
    if build_res.get("returncode") != 0:
        out["detail"] = f"gcloud builds submit failed (exit {build_res.get('returncode')})."
        out["stdout"] = build_res.get("stdout", "")
        out["stderr"] = build_res.get("stderr", "")
        return out

    deploy_res = _run(
        [
            "gcloud", "run", "deploy", service,
            "--image", image,
            "--region", region,
            "--project", gcp_project,
            "--platform", "managed",
            "--allow-unauthenticated",
            "--format", "value(status.url)",
        ],
        cwd=repo,
        timeout=GCLOUD_DEPLOY_TIMEOUT,
    )
    if deploy_res.get("timed_out"):
        out["detail"] = f"gcloud run deploy timed out after {GCLOUD_DEPLOY_TIMEOUT}s"
        out["stderr"] = deploy_res.get("stderr", "")
        return out
    if deploy_res.get("returncode") != 0:
        out["detail"] = f"gcloud run deploy failed (exit {deploy_res.get('returncode')})."
        out["stdout"] = deploy_res.get("stdout", "")
        out["stderr"] = deploy_res.get("stderr", "")
        return out

    url = (deploy_res.get("stdout") or "").strip().splitlines()[-1] if deploy_res.get("stdout") else ""
    out["ok"] = True
    out["detail"] = "deployed to Cloud Run."
    out["url"] = url
    return out


def redeploy(mode: Optional[str] = None) -> Dict[str, Any]:
    """Redeploy / validate the frontend. See module docstring. Never raises."""
    chosen = (mode or os.getenv("REDEPLOY_MODE") or DEFAULT_MODE).strip().lower()
    try:
        if chosen == "cloudrun":
            return _redeploy_cloudrun()
        if chosen == "local":
            return _redeploy_local()
        return {
            "ok": False,
            "mode": chosen,
            "detail": f"unknown redeploy mode '{chosen}' (expected 'local' or 'cloudrun').",
            "url": LOCAL_URL,
        }
    except Exception as e:  # noqa: BLE001 — contract: never raise.
        logger.exception("redeploy unexpected failure")
        return {"ok": False, "mode": chosen, "detail": f"unexpected failure: {e}", "url": ""}
