#!/usr/bin/env python3
"""End-to-end deployment test — runs the full deploy-first pipeline non-interactively."""

import json
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from deployer.credential_manager import store_credential, credential_exists, load_credential, parse_credential, write_gcp_credential_file
from deployer.iac_generator import generate_gcp_terraform
from deployer.deployment_engine import prepare_workspace, write_terraform_files, terraform_init, terraform_plan, terraform_apply, terraform_output, terraform_destroy
from deployer.deployment_validator import DeploymentResult, analyze_and_fix
from deployer.gitlab_saver import GitLabSaver
from deployer.config import MAX_DEPLOY_RETRIES

GCP_CRED_PATH = PROJECT_ROOT / "erica-bot-service-account.json"
GITLAB_TOKEN = os.environ.get("GITLAB_TOKEN", "")
GITLAB_PROJECT = "eimispacheco-group/eimispacheco-project"


def log(msg, indent=0):
    prefix = "  " * indent
    print(f"{prefix}{msg}")


def main():
    print("\n" + "=" * 70)
    print("  SKYRCHITECT E2E DEPLOYMENT TEST — GCP")
    print("  Simulating full user journey: generate → deploy → validate → save")
    print("=" * 70)

    results = {"steps": [], "overall": "PENDING"}

    # ─── Step 1: Store credentials ───
    print("\n" + "─" * 50)
    log("STEP 1: Store GCP credentials securely")
    print("─" * 50)
    try:
        cred_info = store_credential("gcp", str(GCP_CRED_PATH))
        log(f"Stored credentials for project: {cred_info['project_id']}", 1)
        log(f"Service account: {cred_info['client_email']}", 1)
        results["steps"].append({"step": "Store credentials", "status": "PASS", "details": cred_info})
    except Exception as e:
        log(f"FAILED: {e}", 1)
        results["steps"].append({"step": "Store credentials", "status": "FAIL", "error": str(e)})
        results["overall"] = "FAIL"
        _write_results(results)
        return

    # ─── Step 2: Generate Terraform ───
    print("\n" + "─" * 50)
    log("STEP 2: Generate GCP Terraform code")
    print("─" * 50)
    project_id = cred_info["project_id"]
    region = "us-central1"
    environment = "dev"
    config = {"project_id": project_id, "region": region, "environment": environment}

    files = generate_gcp_terraform(
        project_id=project_id,
        region=region,
        environment=environment,
    )
    log(f"Generated {len(files)} files:", 1)
    for fname in files:
        log(f"  - {fname}", 1)
    results["steps"].append({"step": "Generate Terraform", "status": "PASS", "files": list(files.keys())})

    # ─── Step 3: Deploy with retry loop ───
    print("\n" + "─" * 50)
    log("STEP 3: Deploy to GCP (with auto-fix retry loop)")
    print("─" * 50)

    from datetime import datetime
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    workspace = prepare_workspace("gcp", run_id)
    log(f"Workspace: {workspace}", 1)

    deployment_success = False
    final_outputs = {}
    final_files = files

    for attempt in range(1, MAX_DEPLOY_RETRIES + 1):
        log(f"\n--- Attempt {attempt}/{MAX_DEPLOY_RETRIES} ---", 1)

        write_terraform_files(workspace, final_files)

        cred_path = write_gcp_credential_file(workspace)
        var_args = [
            f"-var=project_id={project_id}",
            f"-var=region={region}",
            f"-var=environment={environment}",
            f"-var=credentials_file={cred_path}",
        ]

        # Init
        log("terraform init...", 2)
        ok, output = terraform_init(workspace)
        if not ok:
            log(f"INIT FAILED", 2)
            result = DeploymentResult(False, output)
            log(result.summary(), 2)
            final_files, changes = analyze_and_fix(final_files, result.errors)
            if changes:
                log(f"Auto-fixes: {changes}", 2)
                for f in final_files:
                    (workspace / f).unlink(missing_ok=True)
                continue
            results["steps"].append({
                "step": f"Deploy attempt {attempt}", "status": "FAIL",
                "phase": "init", "errors": [e.get("message", "") for e in result.errors]
            })
            break
        log("terraform init: PASS", 2)

        # Plan
        log("terraform plan...", 2)
        ok, output = terraform_plan(workspace, var_args)
        if not ok:
            log(f"PLAN FAILED", 2)
            result = DeploymentResult(False, output)
            log(result.summary(), 2)
            final_files, changes = analyze_and_fix(final_files, result.errors)
            if changes:
                log(f"Auto-fixes: {changes}", 2)
                for f in final_files:
                    (workspace / f).unlink(missing_ok=True)
                continue
            results["steps"].append({
                "step": f"Deploy attempt {attempt}", "status": "FAIL",
                "phase": "plan", "errors": [e.get("message", "") for e in result.errors]
            })
            break
        log("terraform plan: PASS", 2)

        # Apply
        log("terraform apply...", 2)
        ok, output = terraform_apply(workspace, var_args)
        if not ok:
            log(f"APPLY FAILED", 2)
            result = DeploymentResult(False, output)
            log(result.summary(), 2)
            final_files, changes = analyze_and_fix(final_files, result.errors)
            if changes:
                log(f"Auto-fixes: {changes}", 2)
                for f in final_files:
                    (workspace / f).unlink(missing_ok=True)
                continue
            results["steps"].append({
                "step": f"Deploy attempt {attempt}", "status": "FAIL",
                "phase": "apply", "output_tail": output[-2000:]
            })
            break
        log("terraform apply: PASS", 2)

        # Get outputs
        _, final_outputs = terraform_output(workspace)
        deployment_success = True
        results["steps"].append({
            "step": f"Deploy attempt {attempt}", "status": "PASS",
            "outputs": {k: v.get("value", v) if isinstance(v, dict) else v for k, v in final_outputs.items()}
        })
        break

    if not deployment_success:
        log("\nDEPLOYMENT FAILED — Code will NOT be saved to GitLab.", 1)
        results["overall"] = "FAIL"
        _write_results(results)
        return

    # ─── Step 4: Validate deployment outputs ───
    print("\n" + "─" * 50)
    log("STEP 4: Validate deployment outputs")
    print("─" * 50)
    dep_result = DeploymentResult(True, output, final_outputs)
    log(dep_result.summary(), 1)
    results["steps"].append({"step": "Validate outputs", "status": "PASS", "outputs": dep_result.outputs})

    # ─── Step 5: Save to GitLab (only because deployment succeeded!) ───
    print("\n" + "─" * 50)
    log("STEP 5: Save deployment-validated code to GitLab")
    print("─" * 50)
    if GITLAB_TOKEN:
        try:
            saver = GitLabSaver(GITLAB_TOKEN, GITLAB_PROJECT)
            gitlab_result = saver.save_validated_deployment(
                files=final_files,
                provider="gcp",
                environment=environment,
                deployment_outputs=final_outputs,
            )
            commit_info = gitlab_result.get("commit", {})
            mr_info = gitlab_result.get("merge_request", {})

            if "error" not in str(commit_info):
                log(f"Commit: {commit_info.get('id', 'N/A')[:12]}", 1)
                log(f"Branch: {gitlab_result.get('branch', 'N/A')}", 1)
                log(f"MR URL: {mr_info.get('web_url', 'N/A')}", 1)
                results["steps"].append({"step": "Save to GitLab", "status": "PASS", "mr_url": mr_info.get("web_url", "")})
            else:
                log(f"GitLab save error: {commit_info}", 1)
                results["steps"].append({"step": "Save to GitLab", "status": "FAIL", "error": str(commit_info)})
        except Exception as e:
            log(f"GitLab save error: {e}", 1)
            results["steps"].append({"step": "Save to GitLab", "status": "FAIL", "error": str(e)})
    else:
        log("GITLAB_TOKEN not set — skipping GitLab save", 1)
        results["steps"].append({"step": "Save to GitLab", "status": "SKIPPED"})

    # ─── Step 6: Cleanup ───
    print("\n" + "─" * 50)
    log("STEP 6: Destroy test infrastructure (cleanup)")
    print("─" * 50)
    var_args = [
        f"-var=project_id={project_id}",
        f"-var=region={region}",
        f"-var=environment={environment}",
        f"-var=credentials_file={cred_path}",
    ]
    ok, destroy_out = terraform_destroy(workspace, var_args)
    if ok:
        log("Resources destroyed successfully.", 1)
        results["steps"].append({"step": "Cleanup", "status": "PASS"})
    else:
        log(f"Destroy warning: {destroy_out[:500]}", 1)
        results["steps"].append({"step": "Cleanup", "status": "WARN", "output": destroy_out[:500]})

    # ─── Summary ───
    passed = sum(1 for s in results["steps"] if s["status"] == "PASS")
    failed = sum(1 for s in results["steps"] if s["status"] == "FAIL")
    results["overall"] = "PASS" if failed == 0 else "FAIL"

    print("\n" + "=" * 70)
    print(f"  E2E TEST RESULT: {results['overall']}")
    print(f"  Steps: {passed} passed, {failed} failed, {len(results['steps'])} total")
    print("=" * 70 + "\n")

    _write_results(results)


def _write_results(results):
    out_path = PROJECT_ROOT / "tests" / "e2e_deploy_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    log(f"Results written to {out_path}")


if __name__ == "__main__":
    main()
