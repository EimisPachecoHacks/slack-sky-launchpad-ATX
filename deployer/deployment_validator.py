"""Validate deployments and analyze failures for auto-fix."""

import re


class DeploymentResult:
    def __init__(self, success: bool, output: str, outputs: dict = None):
        self.success = success
        self.output = output
        self.outputs = outputs or {}
        self.errors = self._extract_errors() if not success else []

    def _extract_errors(self) -> list[dict]:
        """Parse terraform error output into structured error objects."""
        errors = []
        error_blocks = re.split(r"(?=Error:)", self.output)
        for block in error_blocks:
            if not block.strip().startswith("Error:"):
                continue
            error = {"raw": block.strip()}

            msg_match = re.search(r"Error:\s*(.+?)(?:\n|$)", block)
            if msg_match:
                error["message"] = msg_match.group(1).strip()

            file_match = re.search(r"on\s+(\S+\.tf)\s+line\s+(\d+)", block)
            if file_match:
                error["file"] = file_match.group(1)
                error["line"] = int(file_match.group(2))

            resource_match = re.search(
                r'in\s+resource\s+"([^"]+)"\s+"([^"]+)"', block
            )
            if resource_match:
                error["resource_type"] = resource_match.group(1)
                error["resource_name"] = resource_match.group(2)

            errors.append(error)
        return errors

    def summary(self) -> str:
        if self.success:
            lines = ["DEPLOYMENT SUCCESSFUL"]
            if self.outputs:
                lines.append("\nOutputs:")
                for k, v in self.outputs.items():
                    val = v.get("value", v) if isinstance(v, dict) else v
                    lines.append(f"  {k} = {val}")
            return "\n".join(lines)
        else:
            lines = [f"DEPLOYMENT FAILED — {len(self.errors)} error(s)"]
            for i, err in enumerate(self.errors, 1):
                lines.append(f"\n  Error {i}: {err.get('message', 'Unknown')}")
                if "file" in err:
                    lines.append(f"    File: {err['file']} line {err['line']}")
                if "resource_type" in err:
                    lines.append(
                        f"    Resource: {err['resource_type']}.{err['resource_name']}"
                    )
            return "\n".join(lines)


def analyze_and_fix(
    files: dict[str, str], errors: list[dict]
) -> tuple[dict[str, str], list[str]]:
    """Attempt to auto-fix terraform code based on deployment errors.

    Returns (fixed_files, list_of_changes_made).
    """
    fixed = dict(files)
    changes = []

    for err in errors:
        msg = err.get("message", "").lower()
        resource = err.get("resource_type", "")
        raw = err.get("raw", "").lower()

        # API not enabled (GCP)
        api_not_enabled = (
            "api has not been enabled" in raw
            or "api has not been used" in raw
            or "service usage" in raw
            or "it is disabled" in raw
        )
        if api_not_enabled:
            api_match = re.search(
                r"apis?/(?:api/)?([a-z][a-z0-9.-]+\.googleapis\.com)", err.get("raw", "")
            )
            if not api_match:
                api_match = re.search(
                    r"([a-z][a-z0-9-]+\.googleapis\.com)", err.get("raw", "")
                )
            if api_match:
                api = api_match.group(1)
                fix = _add_api_enablement(fixed.get("main.tf", ""), api)
                if fix:
                    fixed["main.tf"] = fix
                    changes.append(f"Added google_project_service to enable {api}")

        # Unsupported argument
        if "unsupported argument" in msg:
            arg_match = re.search(r'"([^"]+)" is not expected', err.get("raw", ""))
            if arg_match and err.get("file"):
                arg_name = arg_match.group(1)
                filename = err["file"]
                if filename in fixed:
                    fixed[filename] = _remove_argument(fixed[filename], arg_name)
                    changes.append(f"Removed unsupported argument '{arg_name}' from {filename}")

        # Unsupported block type
        if "unsupported block type" in msg:
            block_match = re.search(r'"([^"]+)" blocks are not expected', err.get("raw", ""))
            if block_match and err.get("file"):
                block_name = block_match.group(1)
                filename = err["file"]
                if filename in fixed:
                    fixed[filename] = _remove_block(fixed[filename], block_name)
                    changes.append(f"Removed unsupported block '{block_name}' from {filename}")

        # Permission denied
        if "permission" in msg and "denied" in raw:
            changes.append(
                f"MANUAL FIX NEEDED: Permission denied for {resource}. "
                "Check IAM roles on the service account."
            )

        # Quota exceeded
        if "quota" in raw:
            changes.append(
                f"MANUAL FIX NEEDED: Quota exceeded for {resource}. "
                "Request quota increase or reduce resource count."
            )

        # Bucket name already exists
        if "bucket" in raw and ("already" in raw or "owned" in raw):
            if "main.tf" in fixed:
                import time
                suffix = str(int(time.time()))[-6:]
                old_name_patterns = [
                    (r'(name\s*=\s*"[^"]*)-skyrchitect-', rf'\1-sky{suffix}-'),
                    (r'(bucket\s*=\s*"skyrchitect-)', f'bucket = "sky{suffix}-'),
                ]
                for pattern, replacement in old_name_patterns:
                    fixed["main.tf"] = re.sub(pattern, replacement, fixed["main.tf"])
                changes.append(f"Renamed bucket with unique suffix {suffix}")

        # Region/zone issues
        if "zone" in msg and "not found" in raw:
            changes.append("MANUAL FIX NEEDED: Invalid zone. Check region configuration.")

    return fixed, changes


def _add_api_enablement(main_tf: str, api: str) -> str:
    """Prepend a google_project_service resource to enable a GCP API."""
    safe_name = api.replace(".", "_").replace("-", "_").rstrip("_")
    block = f"""\
resource "google_project_service" "enable_{safe_name}" {{
  service            = "{api}"
  disable_on_destroy = false
}}

"""
    return block + main_tf


def _remove_argument(content: str, arg_name: str) -> str:
    """Remove a single-line argument from terraform content."""
    pattern = rf"^\s*{re.escape(arg_name)}\s*=.*$\n?"
    return re.sub(pattern, "", content, flags=re.MULTILINE)


def _remove_block(content: str, block_name: str) -> str:
    """Remove a named block and its contents from terraform content."""
    pattern = rf"\s*{re.escape(block_name)}\s*\{{[^}}]*\}}\s*\n?"
    return re.sub(pattern, "\n", content)
