#!/usr/bin/env python3
"""Skyrchitect Deploy-First Pipeline — the full user journey.

Usage:
    python -m deployer.main                          # Interactive mode
    python -m deployer.main --provider gcp --auto    # Auto mode with stored creds
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

from .config import MAX_DEPLOY_RETRIES, SUPPORTED_PROVIDERS
from .credential_manager import (
    credential_exists,
    get_aws_keys,
    load_credential,
    parse_credential,
    store_credential,
    write_gcp_credential_file,
)
from .deployment_engine import (
    prepare_workspace,
    terraform_apply,
    terraform_destroy,
    terraform_init,
    terraform_output,
    terraform_plan,
    write_terraform_files,
)
from .deployment_validator import DeploymentResult, analyze_and_fix
from .gitlab_saver import GitLabSaver
from .iac_generator import generate_aws_terraform, generate_gcp_terraform
from .log_collector import collect_failure_context
from .skill_library import save_skill
from .deploy_events import record_event


def _narrate(phase: str, text: str) -> None:
    """Print a loop event and, if the Gemini Live narration bus is reachable, stream it."""
    print(f"  [{phase}] {text}")
    try:  # the web backend ships the Gemini Live bus; degrade silently from the CLI
        from backend.narration import narrate as _live_narrate

        _live_narrate(phase, text)
    except Exception:
        pass


def _repair_failure(
    provider: str,
    config: dict,
    workspace: Path,
    files: dict[str, str],
    output: str,
    agent_env_id: str | None,
) -> tuple[dict[str, str], list[str], str | None]:
    """Self-improving repair step.

    On a failed terraform run: collect rich failure context (incl. cloud logs),
    ask the Antigravity managed agent to diagnose + fix the HCL AND author a new
    reusable SKILL.md, persist that skill, and return the corrected files. Falls
    back to the legacy regex auto-fixer if the agent is unavailable.

    Returns (files, changes, agent_env_id) — `agent_env_id` carries the hosted
    agent's stateful-memory environment id across retries.
    """
    result = DeploymentResult(False, output)
    first_msg = result.errors[0].get("message", "deployment error") if result.errors else "deployment error"
    run_id = workspace.name
    _narrate("failure", f"Deployment failed: {first_msg}")
    record_event("failure", first_msg, provider=provider, run_id=run_id, error_signature=first_msg)

    project_id = config.get("project_id", "")
    try:
        ctx = collect_failure_context(provider, project_id, workspace, output, result.errors)
    except Exception as exc:  # never let context-gathering break the loop
        ctx = {"provider": provider, "terraform_errors": result.errors, "summary": output[:1000]}
        print(f"  (failure-context collection degraded: {exc})")

    _narrate("diagnose", "Handing the logs to the Gemma 3 repair agent to diagnose...")
    record_event("diagnose", "Gemma 3 repair agent diagnosing the failure", provider=provider, run_id=run_id, error_signature=first_msg)
    try:
        from .repair_agent import diagnose_and_author

        out = diagnose_and_author(ctx, files, existing_skills=None, env_id=agent_env_id)
        agent_env_id = out.get("env_id", agent_env_id)
        fixed = out.get("fixed_files") or {}
        new_skill = out.get("new_skill")
        changes = list(out.get("changes") or [])

        if new_skill:
            try:
                saved = save_skill(new_skill)
                slug = saved.get("slug", new_skill.get("name", "skill"))
                changes.append(f"Learned skill: {slug}")
                _narrate("learned", f"Authored a new reusable skill from this failure: {slug}")
                record_event(
                    "learned", f"Authored reusable skill: {slug}", provider=provider,
                    run_id=run_id, error_signature=new_skill.get("error_signature", first_msg),
                    skill_slug=slug,
                )
            except Exception as exc:
                print(f"  (skill save failed: {exc})")

        if fixed:
            files = {**files, **fixed}
        if changes:
            _narrate("retry", "Applying the fix and retrying the deployment...")
            record_event("retry", "Applying fix and retrying deploy", provider=provider, run_id=run_id)
            return files, changes, agent_env_id
    except Exception as exc:
        print(f"  (Gemma 3 repair unavailable, using legacy auto-fixer: {exc})")

    # Fallback: deterministic regex auto-fixer.
    files, changes = analyze_and_fix(files, result.errors)
    return files, changes, agent_env_id


def print_banner():
    print("\n" + "=" * 60)
    print("   SKY LAUNCHPAD — Self-Improving Infrastructure Pipeline")
    print("   Generate → Deploy → Learn-on-Failure → Validate → Save to GitLab")
    print("=" * 60 + "\n")


def print_step(step: int, total: int, msg: str):
    print(f"\n{'─' * 50}")
    print(f"  Step {step}/{total}: {msg}")
    print(f"{'─' * 50}\n")


def select_provider() -> str:
    print("Select your cloud provider:\n")
    providers = list(SUPPORTED_PROVIDERS.items())
    for i, (key, info) in enumerate(providers, 1):
        stored = " [credentials stored]" if credential_exists(key) else ""
        print(f"  {i}. {info['name']} ({key.upper()}){stored}")
    print()
    while True:
        choice = input("Enter choice (1 or 2): ").strip()
        if choice in ("1", "gcp"):
            return "gcp"
        if choice in ("2", "aws"):
            return "aws"
        print("Invalid choice. Enter 1 for GCP or 2 for AWS.")


def setup_credentials(provider: str) -> dict:
    """Handle credential setup — one-time storage."""
    if credential_exists(provider):
        raw = load_credential(provider)
        info = parse_credential(provider, raw)
        print(f"  Using stored {provider.upper()} credentials.")
        print(f"  Account info: {json.dumps(info, indent=4)}")
        reuse = input("\n  Use these credentials? (y/n): ").strip().lower()
        if reuse == "y":
            return info

    pinfo = SUPPORTED_PROVIDERS[provider]
    print(f"\n  Credential type needed: {pinfo['credential_type']}")
    cred_path = input(f"  Path to {provider.upper()} credential file: ").strip()
    info = store_credential(provider, cred_path)
    print(f"\n  Credentials stored securely at ~/.skyrchitect/credentials/")
    print(f"  Account info: {json.dumps(info, indent=4)}")
    return info


def get_deployment_config(provider: str, cred_info: dict) -> dict:
    """Gather deployment parameters from the user."""
    print("  Configure your deployment:\n")

    if provider == "gcp":
        project_id = cred_info.get("project_id", "")
        if project_id:
            print(f"  Detected GCP project: {project_id}")
            use_detected = input("  Use this project? (y/n): ").strip().lower()
            if use_detected != "y":
                project_id = input("  Enter GCP project ID: ").strip()
        else:
            project_id = input("  Enter GCP project ID: ").strip()

        region = input("  Region [us-central1]: ").strip() or "us-central1"
        environment = input("  Environment [dev]: ").strip() or "dev"

        return {
            "project_id": project_id,
            "region": region,
            "environment": environment,
        }

    elif provider == "aws":
        account_id = cred_info.get("account_id", "")
        if account_id:
            print(f"  Detected AWS account: {account_id}")

        if cred_info.get("needs_access_keys"):
            print("\n  WARNING: Your AWS credentials are console-only.")
            print("  Terraform requires programmatic Access Keys.")
            print("  Please generate them at:")
            print(f"  {cred_info.get('console_url', 'AWS Console')} > IAM > Users > Security credentials\n")
            key_id = input("  AWS Access Key ID: ").strip()
            secret = input("  AWS Secret Access Key: ").strip()
            cred_json = json.dumps({
                "aws_access_key_id": key_id,
                "aws_secret_access_key": secret,
                "region": "us-east-1",
            })
            from .credential_manager import _ensure_dirs, _fernet
            from .config import CREDENTIALS_DIR
            import stat
            _ensure_dirs()
            encrypted = _fernet().encrypt(cred_json.encode())
            dest = CREDENTIALS_DIR / "aws.enc"
            dest.write_bytes(encrypted)
            os.chmod(dest, stat.S_IRUSR | stat.S_IWUSR)
            cred_info = {"aws_access_key_id": key_id, "region": "us-east-1"}

        region = input("  Region [us-east-1]: ").strip() or "us-east-1"
        environment = input("  Environment [dev]: ").strip() or "dev"

        return {
            "account_id": account_id or "unknown",
            "region": region,
            "environment": environment,
        }


def generate_code(provider: str, config: dict) -> dict[str, str]:
    """Generate Terraform code for the selected provider."""
    if provider == "gcp":
        return generate_gcp_terraform(
            project_id=config["project_id"],
            region=config["region"],
            environment=config["environment"],
        )
    elif provider == "aws":
        return generate_aws_terraform(
            account_id=config["account_id"],
            region=config["region"],
            environment=config["environment"],
        )


def deploy_with_retry(
    provider: str,
    files: dict[str, str],
    config: dict,
    max_retries: int = MAX_DEPLOY_RETRIES,
) -> DeploymentResult:
    """Deploy infrastructure with automatic error analysis and retry."""
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    workspace = prepare_workspace(provider, run_id)
    agent_env_id = None  # carries the Antigravity agent's stateful memory across retries

    for attempt in range(1, max_retries + 1):
        print(f"\n  Attempt {attempt}/{max_retries}")
        print(f"  Workspace: {workspace}\n")

        write_terraform_files(workspace, files)

        var_args = _build_var_args(provider, config, workspace)

        # Init
        print("  Running terraform init...")
        ok, output = terraform_init(workspace)
        if not ok:
            print(f"  INIT FAILED:\n{output[:500]}")
            files, changes, agent_env_id = _repair_failure(
                provider, config, workspace, files, output, agent_env_id
            )
            if changes:
                print(f"  Auto-fixes applied: {changes}")
                continue
            return DeploymentResult(False, output)

        print("  terraform init: OK")

        # Plan
        print("  Running terraform plan...")
        ok, output = terraform_plan(workspace, var_args)
        if not ok:
            print(f"  PLAN FAILED:\n{output[:1000]}")
            files, changes, agent_env_id = _repair_failure(
                provider, config, workspace, files, output, agent_env_id
            )
            if changes:
                print(f"  Auto-fixes applied: {changes}")
                continue
            return DeploymentResult(False, output)

        print("  terraform plan: OK")

        # Apply
        print("  Running terraform apply...")
        ok, output = terraform_apply(workspace, var_args)
        if not ok:
            print(f"  APPLY FAILED:\n{output[:1500]}")
            files, changes, agent_env_id = _repair_failure(
                provider, config, workspace, files, output, agent_env_id
            )
            if changes:
                print(f"  Auto-fixes applied: {changes}")
                continue
            return DeploymentResult(False, output)

        print("  terraform apply: OK")
        record_event(
            "success",
            f"Deployment succeeded on attempt {attempt}",
            provider=provider, run_id=run_id, attempt=attempt,
        )

        # Get outputs
        _, outputs = terraform_output(workspace)

        # Register the deployed app in the queryable store (for the Apps dashboard).
        try:
            import skydb
            url = ""
            for v in (outputs or {}).values():
                val = v.get("value", v) if isinstance(v, dict) else v
                if isinstance(val, str) and val.startswith("http"):
                    url = val
                    break
            app = skydb.upsert_app({
                "name": config.get("project_id") or f"{provider}-{config.get('environment', 'dev')}",
                "provider": provider,
                "environment": config.get("environment", "dev"),
                "url": url,
                "source": "terraform-deploy",
            })
            skydb.set_app_health(app["app_id"], bool(url), "deployed")
        except Exception:
            pass

        result = DeploymentResult(True, output, outputs)
        result.workspace = workspace
        result.files = files
        return result

    return DeploymentResult(False, "Max retries exceeded", {})


def _build_var_args(provider: str, config: dict, workspace: Path) -> list[str]:
    """Build terraform -var arguments."""
    args = []
    if provider == "gcp":
        cred_path = write_gcp_credential_file(workspace)
        args.extend([
            f"-var=project_id={config['project_id']}",
            f"-var=region={config['region']}",
            f"-var=environment={config['environment']}",
            f"-var=credentials_file={cred_path}",
        ])
    elif provider == "aws":
        key_id, secret_key = get_aws_keys()
        args.extend([
            f"-var=region={config['region']}",
            f"-var=environment={config['environment']}",
            f"-var=aws_access_key_id={key_id}",
            f"-var=aws_secret_access_key={secret_key}",
        ])
    return args


def save_to_gitlab(
    provider: str, config: dict, files: dict, outputs: dict
) -> dict:
    """Save validated code to GitLab."""
    token = os.environ.get("GITLAB_TOKEN", "")
    project = os.environ.get(
        "GITLAB_PROJECT", "eimispacheco-group/eimispacheco-project"
    )

    if not token:
        token = input("  GitLab Personal Access Token: ").strip()

    saver = GitLabSaver(token, project)
    return saver.save_validated_deployment(
        files=files,
        provider=provider,
        environment=config.get("environment", "dev"),
        deployment_outputs=outputs,
    )


def cleanup(workspace: Path, provider: str, config: dict):
    """Destroy deployed infrastructure to avoid costs."""
    print("\n  Cleaning up deployed resources...")
    var_args = _build_var_args(provider, config, workspace)
    ok, output = terraform_destroy(workspace, var_args)
    if ok:
        print("  Resources destroyed successfully.")
    else:
        print(f"  WARNING: Destroy failed. Manual cleanup may be needed.\n{output[:500]}")


def run_pipeline(provider: str = None, auto: bool = False):
    """Execute the full deploy-first pipeline."""
    print_banner()
    total_steps = 7

    # Step 1: Select provider
    print_step(1, total_steps, "Select Cloud Provider")
    if not provider:
        provider = select_provider()
    print(f"  Selected: {SUPPORTED_PROVIDERS[provider]['name']}")

    # Step 2: Credentials
    print_step(2, total_steps, "Configure Credentials")
    cred_info = setup_credentials(provider)

    # Step 3: Deployment config
    print_step(3, total_steps, "Deployment Configuration")
    config = get_deployment_config(provider, cred_info)
    print(f"\n  Configuration: {json.dumps(config, indent=4)}")

    # Step 4: Generate IaC
    print_step(4, total_steps, "Generate Infrastructure Code")
    files = generate_code(provider, config)
    print(f"  Generated {len(files)} Terraform files:")
    for f in files:
        print(f"    - {f}")

    # Step 5: Deploy with retry loop
    print_step(5, total_steps, "Deploy to Cloud (with auto-fix retry)")
    result = deploy_with_retry(provider, files, config)
    print(f"\n{result.summary()}")

    if not result.success:
        print("\n  PIPELINE STOPPED: Deployment failed after all retries.")
        print("  Code will NOT be saved to GitLab.")
        print("\n  Errors to investigate:")
        for err in result.errors:
            print(f"    - {err.get('message', err.get('raw', 'Unknown'))}")
        return False

    # Step 6: Save to GitLab (only on success!)
    print_step(6, total_steps, "Save Validated Code to GitLab")
    print("  Deployment succeeded! Saving validated code to GitLab...")
    gitlab_result = save_to_gitlab(provider, config, result.files, result.outputs)
    if "error" in str(gitlab_result.get("commit", {})):
        print(f"  GitLab save warning: {gitlab_result}")
    else:
        mr_url = gitlab_result.get("merge_request", {}).get("web_url", "")
        print(f"  Code saved to GitLab!")
        if mr_url:
            print(f"  Merge Request: {mr_url}")

    # Step 7: Cleanup
    print_step(7, total_steps, "Cleanup (destroy test infrastructure)")
    should_cleanup = input("  Destroy deployed resources? (y/n) [y]: ").strip().lower()
    if should_cleanup != "n":
        cleanup(result.workspace, provider, config)

    print("\n" + "=" * 60)
    print("  PIPELINE COMPLETE — Deploy-first validation successful!")
    print("=" * 60 + "\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Skyrchitect Deploy-First Pipeline")
    parser.add_argument("--provider", choices=["gcp", "aws"], help="Cloud provider")
    parser.add_argument(
        "--auto", action="store_true", help="Use stored credentials automatically"
    )
    args = parser.parse_args()
    run_pipeline(provider=args.provider, auto=args.auto)


if __name__ == "__main__":
    main()
