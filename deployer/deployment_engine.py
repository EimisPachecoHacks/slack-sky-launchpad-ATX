"""Terraform deployment engine — init, plan, apply, destroy."""

import json
import os
import subprocess
from pathlib import Path

from .config import WORKDIR


def prepare_workspace(provider: str, run_id: str) -> Path:
    """Create an isolated workspace directory for a deployment."""
    ws = WORKDIR / provider / run_id
    ws.mkdir(parents=True, exist_ok=True)
    return ws


def write_terraform_files(workspace: Path, files: dict[str, str]):
    """Write generated Terraform files into the workspace."""
    for filename, content in files.items():
        fp = workspace / filename
        fp.write_text(content)


def terraform_init(workspace: Path) -> tuple[bool, str]:
    """Run terraform init."""
    return _run_terraform(workspace, ["init", "-input=false", "-no-color"])


def terraform_plan(workspace: Path, var_args: list[str] = None) -> tuple[bool, str]:
    """Run terraform plan. Returns (success, output)."""
    cmd = ["plan", "-input=false", "-no-color", "-detailed-exitcode"]
    if var_args:
        cmd.extend(var_args)
    success, output = _run_terraform(workspace, cmd)
    return success, output


def terraform_apply(workspace: Path, var_args: list[str] = None) -> tuple[bool, str]:
    """Run terraform apply -auto-approve. Returns (success, output)."""
    cmd = ["apply", "-auto-approve", "-input=false", "-no-color"]
    if var_args:
        cmd.extend(var_args)
    return _run_terraform(workspace, cmd)


def terraform_output(workspace: Path) -> tuple[bool, dict]:
    """Get terraform outputs as JSON."""
    success, raw = _run_terraform(workspace, ["output", "-json", "-no-color"])
    if success:
        try:
            return True, json.loads(raw)
        except json.JSONDecodeError:
            return False, {"error": "Failed to parse terraform output"}
    return False, {"error": raw}


def terraform_destroy(workspace: Path, var_args: list[str] = None) -> tuple[bool, str]:
    """Run terraform destroy -auto-approve."""
    cmd = ["destroy", "-auto-approve", "-input=false", "-no-color"]
    if var_args:
        cmd.extend(var_args)
    return _run_terraform(workspace, cmd)


def _run_terraform(workspace: Path, args: list[str]) -> tuple[bool, str]:
    """Execute a terraform command in the given workspace."""
    cmd = ["terraform", f"-chdir={workspace}"] + args
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            env={**os.environ, "TF_IN_AUTOMATION": "1"},
        )
        output = result.stdout + result.stderr
        exit_code = result.returncode
        # terraform plan returns 2 for "changes present" which is success
        if args[0] == "plan" and "-detailed-exitcode" in args:
            return exit_code in (0, 2), output
        return exit_code == 0, output
    except subprocess.TimeoutExpired:
        return False, "ERROR: Terraform command timed out after 600 seconds"
    except FileNotFoundError:
        return False, "ERROR: terraform CLI not found. Install with: brew install terraform"
