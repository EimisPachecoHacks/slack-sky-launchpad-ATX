"""Collect rich failure context for the repair agent on a failed deployment.

On a failed terraform deployment this module gathers MORE than terraform
stdout: it parses structured errors, extracts the offending `.tf` snippets,
and (for GCP) pulls real Cloud Logging entries to feed the repair agent.

All new dependencies are imported LAZILY inside try/except. If nothing is
available the module degrades gracefully: it still returns the structured
terraform context and an empty ``cloud_logs`` list with an explanatory note.
It NEVER raises from log collection.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

# Tail size for the terraform output excerpt.
_EXCERPT_CHARS = 2000
# Number of context lines to show around an error line in a .tf file.
_SNIPPET_WINDOW = 10


def collect_failure_context(
    provider: str,
    project_id: str,
    workspace,
    terraform_output: str,
    parsed_errors: list[dict] | None = None,
) -> dict:
    """Gather rich failure context for the repair agent.

    Returns a dict with the structured terraform errors, a trimmed output
    excerpt, terraform code snippets around each error, GCP cloud logs (when
    obtainable), and a short human summary. See module docstring for intent.
    """
    workspace_path = Path(workspace) if workspace is not None else None

    terraform_output = terraform_output or ""
    excerpt = _tail(terraform_output, _EXCERPT_CHARS)

    if parsed_errors:
        terraform_errors = list(parsed_errors)
    else:
        terraform_errors = _parse_errors_minimal(terraform_output)

    tf_snippets = _gather_tf_snippets(workspace_path, terraform_errors)

    cloud_logs, cloud_logs_note = _collect_cloud_logs(
        provider, project_id, workspace_path
    )

    summary = _build_summary(
        provider=provider,
        project_id=project_id,
        terraform_errors=terraform_errors,
        cloud_logs=cloud_logs,
        cloud_logs_note=cloud_logs_note,
    )

    return {
        "provider": provider,
        "project_id": project_id,
        "terraform_errors": terraform_errors,
        "terraform_output_excerpt": excerpt,
        "cloud_logs": cloud_logs,
        "cloud_logs_note": cloud_logs_note,
        "tf_snippets": tf_snippets,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# Terraform output helpers
# ---------------------------------------------------------------------------


def _tail(text: str, max_chars: int) -> str:
    """Return the last ``max_chars`` of ``text``, trimmed at a line boundary."""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    tail = text[-max_chars:]
    # Avoid starting mid-line for readability.
    newline = tail.find("\n")
    if 0 <= newline < len(tail) - 1:
        tail = tail[newline + 1 :]
    return "...(truncated)...\n" + tail


def _parse_errors_minimal(terraform_output: str) -> list[dict]:
    """Minimal local parse of ``Error:`` blocks.

    Intentionally NOT importing the project's DeploymentResult to avoid
    coupling. Mirrors its shape: raw / message / file / line where present.
    """
    errors: list[dict] = []
    for block in re.split(r"(?=Error:)", terraform_output or ""):
        if not block.strip().startswith("Error:"):
            continue
        error: dict = {"raw": block.strip()}

        msg_match = re.search(r"Error:\s*(.+?)(?:\n|$)", block)
        if msg_match:
            error["message"] = msg_match.group(1).strip()

        file_match = re.search(r"on\s+(\S+\.tf)\s+line\s+(\d+)", block)
        if file_match:
            error["file"] = file_match.group(1)
            error["line"] = int(file_match.group(2))

        resource_match = re.search(r'in\s+resource\s+"([^"]+)"\s+"([^"]+)"', block)
        if resource_match:
            error["resource_type"] = resource_match.group(1)
            error["resource_name"] = resource_match.group(2)

        errors.append(error)
    return errors


def _gather_tf_snippets(
    workspace: Path | None, errors: list[dict]
) -> dict[str, str]:
    """Read ~``_SNIPPET_WINDOW`` lines around each error line from workspace."""
    snippets: dict[str, str] = {}
    if workspace is None:
        return snippets

    for err in errors:
        filename = err.get("file")
        line = err.get("line")
        if not filename or not line:
            continue
        if filename in snippets:
            continue
        try:
            tf_path = workspace / filename
            if not tf_path.is_file():
                continue
            content = tf_path.read_text(encoding="utf-8", errors="replace")
            lines = content.splitlines()
            idx = int(line) - 1  # 1-based -> 0-based
            start = max(0, idx - _SNIPPET_WINDOW // 2)
            end = min(len(lines), idx + _SNIPPET_WINDOW // 2 + 1)
            window = []
            for n in range(start, end):
                marker = ">>" if n == idx else "  "
                window.append(f"{marker} {n + 1:>4} | {lines[n]}")
            snippets[filename] = "\n".join(window)
        except Exception:
            # Missing/unreadable file: skip rather than fail the whole collect.
            continue
    return snippets


# ---------------------------------------------------------------------------
# Cloud log collection
# ---------------------------------------------------------------------------


def _collect_cloud_logs(
    provider: str, project_id: str, workspace: Path | None
) -> tuple[list[dict], str]:
    """Dispatch cloud-log collection by provider. Never raises."""
    prov = (provider or "").strip().lower()
    if prov == "gcp":
        creds_path = _find_gcp_creds(workspace)
        if not creds_path:
            return (
                [],
                "No GCP credentials found (GOOGLE_APPLICATION_CREDENTIALS unset "
                "and no gcp-credentials.json in workspace); skipped Cloud Logging.",
            )
        return _fetch_gcp_logs(project_id, creds_path)
    return (
        [],
        "cloud log fetch only implemented for GCP in this build",
    )


def _find_gcp_creds(workspace: Path | None) -> str | None:
    """Locate a service-account JSON via env or the workspace dir."""
    import os

    env_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if env_path and Path(env_path).is_file():
        return env_path

    if workspace is not None:
        candidate = workspace / "gcp-credentials.json"
        try:
            if candidate.is_file():
                return str(candidate)
        except Exception:
            pass
    return None


def _fetch_gcp_logs(
    project_id: str, creds_path: str, minutes: int = 15
) -> tuple[list[dict], str]:
    """Fetch recent ERROR+ entries from GCP Cloud Logging.

    Prefers the ``google-cloud-logging`` SDK; falls back to a REST call to
    ``entries:list`` with an OAuth token minted from the service-account JSON.
    Everything is wrapped: on ANY failure returns ([], note) and never raises.
    """
    # --- Attempt 1: official SDK ------------------------------------------
    try:
        logs = _fetch_gcp_logs_sdk(project_id, creds_path, minutes)
        if logs is not None:
            return logs, (
                f"Fetched {len(logs)} GCP Cloud Logging entry(ies) "
                f"(severity>=ERROR, last {minutes}m) via google-cloud-logging SDK."
            )
    except Exception as exc:  # pragma: no cover - defensive
        sdk_note = f"SDK path failed ({type(exc).__name__}: {exc}); "
    else:
        sdk_note = "google-cloud-logging SDK unavailable; "

    # --- Attempt 2: REST + minted OAuth token -----------------------------
    try:
        logs = _fetch_gcp_logs_rest(project_id, creds_path, minutes)
        if logs is not None:
            return logs, (
                f"Fetched {len(logs)} GCP Cloud Logging entry(ies) "
                f"(severity>=ERROR, last {minutes}m) via REST entries:list."
            )
        return [], sdk_note + "REST path returned no usable response."
    except Exception as exc:
        return [], (
            sdk_note
            + f"REST path failed ({type(exc).__name__}: {exc}); no cloud logs attached."
        )


def _log_filter(minutes: int) -> str:
    """Build the Cloud Logging filter string: ERROR+ in the last N minutes."""
    since = time.strftime(
        "%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - minutes * 60)
    )
    return f'severity>=ERROR AND timestamp>="{since}"'


def _fetch_gcp_logs_sdk(
    project_id: str, creds_path: str, minutes: int
) -> list[dict] | None:
    """Use google-cloud-logging if importable. Returns None if lib missing."""
    try:
        from google.cloud import logging as gcl  # type: ignore
        from google.oauth2 import service_account  # type: ignore
    except Exception:
        return None

    credentials = service_account.Credentials.from_service_account_file(creds_path)
    client = gcl.Client(project=project_id, credentials=credentials)

    entries = client.list_entries(
        filter_=_log_filter(minutes),
        order_by=gcl.DESCENDING,
        page_size=20,
        max_results=20,
    )

    results: list[dict] = []
    for entry in entries:
        results.append(_map_sdk_entry(entry))
        if len(results) >= 20:
            break
    return results


def _map_sdk_entry(entry) -> dict:
    """Map a google-cloud-logging entry object to our flat dict."""
    payload = getattr(entry, "payload", None)
    if isinstance(payload, dict):
        message = payload.get("message") or json.dumps(payload)[:1000]
    else:
        message = str(payload) if payload is not None else ""

    resource = getattr(entry, "resource", None)
    resource_type = getattr(resource, "type", "") if resource else ""

    ts = getattr(entry, "timestamp", None)
    timestamp = ts.isoformat() if ts is not None else ""

    return {
        "timestamp": timestamp,
        "severity": str(getattr(entry, "severity", "") or ""),
        "message": message,
        "resource": resource_type,
    }


def _fetch_gcp_logs_rest(
    project_id: str, creds_path: str, minutes: int
) -> list[dict] | None:
    """REST fallback. Mints an OAuth token from the SA JSON, then queries.

    Returns None if the auth libraries needed to mint a token are unavailable.
    """
    token = _mint_access_token(creds_path)
    if token is None:
        return None

    import urllib.request

    body = json.dumps(
        {
            "resourceNames": [f"projects/{project_id}"],
            "filter": _log_filter(minutes),
            "orderBy": "timestamp desc",
            "pageSize": 20,
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "https://logging.googleapis.com/v2/entries:list",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    results: list[dict] = []
    for entry in data.get("entries", [])[:20]:
        results.append(_map_rest_entry(entry))
    return results


def _map_rest_entry(entry: dict) -> dict:
    """Map a REST entries:list entry to our flat dict."""
    message = ""
    if "jsonPayload" in entry:
        jp = entry["jsonPayload"]
        message = jp.get("message") if isinstance(jp, dict) else None
        if not message:
            message = json.dumps(jp)[:1000]
    elif "textPayload" in entry:
        message = entry["textPayload"]
    elif "protoPayload" in entry:
        pp = entry["protoPayload"]
        if isinstance(pp, dict):
            status = pp.get("status", {})
            message = status.get("message") or json.dumps(pp)[:1000]
        else:
            message = str(pp)[:1000]

    resource = entry.get("resource", {})
    resource_type = resource.get("type", "") if isinstance(resource, dict) else ""

    return {
        "timestamp": entry.get("timestamp", ""),
        "severity": entry.get("severity", ""),
        "message": message or "",
        "resource": resource_type,
    }


def _mint_access_token(creds_path: str) -> str | None:
    """Mint a read-only logging OAuth token from a service-account JSON.

    Prefers google.auth; this avoids hand-rolling JWT signing. Returns None
    if the auth libraries are not importable.
    """
    try:
        from google.oauth2 import service_account  # type: ignore
        from google.auth.transport.requests import Request  # type: ignore
    except Exception:
        return None

    credentials = service_account.Credentials.from_service_account_file(
        creds_path,
        scopes=["https://www.googleapis.com/auth/logging.read"],
    )
    credentials.refresh(Request())
    return credentials.token


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------


def _build_summary(
    provider: str,
    project_id: str,
    terraform_errors: list[dict],
    cloud_logs: list[dict],
    cloud_logs_note: str,
) -> str:
    """Build a short human-readable summary combining all signals."""
    n = len(terraform_errors)
    lines = [
        f"Deployment failed on {provider or 'unknown'} project "
        f"'{project_id or 'unknown'}' with {n} terraform error(s)."
    ]

    top = [e.get("message") for e in terraform_errors if e.get("message")][:3]
    if top:
        lines.append("Top errors:")
        for msg in top:
            lines.append(f"  - {msg}")

    if cloud_logs:
        lines.append(f"Attached {len(cloud_logs)} cloud log entry(ies).")
    else:
        lines.append(f"No cloud logs attached: {cloud_logs_note}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Smoke test
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    result = collect_failure_context(
        "gcp",
        "demo-proj",
        Path("/nonexistent"),
        "Error: Error when reading or editing Project Service ... "
        "Compute Engine API has not been enabled on project demo-proj",
        parsed_errors=None,
    )

    assert isinstance(result, dict), "result must be a dict"
    assert result["terraform_errors"], "expected non-empty terraform_errors"
    assert result["cloud_logs"] == [], "expected empty cloud_logs (no creds)"
    assert result["cloud_logs_note"], "expected a cloud_logs_note explaining why"
    assert result["provider"] == "gcp"
    assert result["project_id"] == "demo-proj"

    print("PASS")
    print("-" * 60)
    print("terraform_errors:", json.dumps(result["terraform_errors"], indent=2))
    print("cloud_logs:", result["cloud_logs"])
    print("cloud_logs_note:", result["cloud_logs_note"])
    print("summary:\n" + result["summary"])
