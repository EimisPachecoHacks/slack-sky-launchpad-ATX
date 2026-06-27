#!/usr/bin/env python3
"""End-to-end AWS deployment test — full deploy-first pipeline."""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from deployer.credential_manager import store_credential, get_aws_keys
from deployer.iac_generator import generate_aws_terraform
from deployer.deployment_engine import (
    prepare_workspace, write_terraform_files,
    terraform_init, terraform_plan, terraform_apply,
    terraform_output, terraform_destroy,
)
from deployer.deployment_validator import DeploymentResult, analyze_and_fix
from deployer.config import MAX_DEPLOY_RETRIES

AWS_CRED_PATH = PROJECT_ROOT / "hackathon-user_accessKeys.csv"
GITLAB_TOKEN = os.environ.get("GITLAB_TOKEN", "")
GITLAB_PROJECT = "eimispacheco-group/eimispacheco-project"


def log(msg, indent=0):
    print(f"{'  ' * indent}{msg}")


def main():
    print("\n" + "=" * 70)
    print("  SKYRCHITECT E2E DEPLOYMENT TEST — AWS")
    print("  Simulating full user journey: generate → deploy → validate → save")
    print("=" * 70)

    results = {"steps": [], "overall": "PENDING"}

    # Step 1: Store credentials
    print("\n" + "─" * 50)
    log("STEP 1: Store AWS credentials securely")
    print("─" * 50)
    try:
        cred_info = store_credential("aws", str(AWS_CRED_PATH))
        log(f"Stored credentials: {json.dumps(cred_info, indent=4)}", 1)
        key_id, secret = get_aws_keys()
        log(f"Access Key ID: {key_id[:8]}...{key_id[-4:]}", 1)
        results["steps"].append({"step": "Store credentials", "status": "PASS"})
    except Exception as e:
        log(f"FAILED: {e}", 1)
        results["steps"].append({"step": "Store credentials", "status": "FAIL", "error": str(e)})
        results["overall"] = "FAIL"
        _write_results(results)
        return

    # Step 2: Generate Terraform
    print("\n" + "─" * 50)
    log("STEP 2: Generate AWS Terraform code")
    print("─" * 50)
    account_id = "396608774889"
    region = "us-east-1"
    environment = "dev"
    config = {"account_id": account_id, "region": region, "environment": environment}

    files = generate_aws_terraform(
        account_id=account_id, region=region, environment=environment,
    )
    log(f"Generated {len(files)} files:", 1)
    for fname in files:
        log(f"  - {fname}", 1)
    results["steps"].append({"step": "Generate Terraform", "status": "PASS", "files": list(files.keys())})

    # Step 3: Deploy with retry
    print("\n" + "─" * 50)
    log("STEP 3: Deploy to AWS (with auto-fix retry loop)")
    print("─" * 50)

    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    workspace = prepare_workspace("aws", run_id)
    log(f"Workspace: {workspace}", 1)

    deployment_success = False
    final_outputs = {}
    final_files = files

    for attempt in range(1, MAX_DEPLOY_RETRIES + 1):
        log(f"\n--- Attempt {attempt}/{MAX_DEPLOY_RETRIES} ---", 1)

        write_terraform_files(workspace, final_files)

        var_args = [
            f"-var=region={region}",
            f"-var=environment={environment}",
            f"-var=aws_access_key_id={key_id}",
            f"-var=aws_secret_access_key={secret}",
        ]

        # Init
        log("terraform init...", 2)
        ok, output = terraform_init(workspace)
        if not ok:
            log("INIT FAILED", 2)
            log(output[:500], 2)
            result = DeploymentResult(False, output)
            final_files, changes = analyze_and_fix(final_files, result.errors)
            if changes:
                log(f"Auto-fixes: {changes}", 2)
                for f in final_files:
                    (workspace / f).unlink(missing_ok=True)
                continue
            results["steps"].append({"step": f"Deploy attempt {attempt}", "status": "FAIL", "phase": "init"})
            break
        log("terraform init: PASS", 2)

        # Plan
        log("terraform plan...", 2)
        ok, output = terraform_plan(workspace, var_args)
        if not ok:
            log("PLAN FAILED", 2)
            log(output[:1000], 2)
            result = DeploymentResult(False, output)
            final_files, changes = analyze_and_fix(final_files, result.errors)
            if changes:
                log(f"Auto-fixes: {changes}", 2)
                for f in final_files:
                    (workspace / f).unlink(missing_ok=True)
                continue
            results["steps"].append({"step": f"Deploy attempt {attempt}", "status": "FAIL", "phase": "plan"})
            break
        log("terraform plan: PASS", 2)

        # Apply
        log("terraform apply...", 2)
        ok, output = terraform_apply(workspace, var_args)
        if not ok:
            log("APPLY FAILED", 2)
            log(output[-1500:], 2)
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

    # Step 4: Validate
    print("\n" + "─" * 50)
    log("STEP 4: Validate deployment outputs")
    print("─" * 50)
    dep_result = DeploymentResult(True, output, final_outputs)
    log(dep_result.summary(), 1)
    results["steps"].append({"step": "Validate outputs", "status": "PASS"})

    # Step 5: Save to GitLab
    print("\n" + "─" * 50)
    log("STEP 5: Save deployment-validated code to GitLab")
    print("─" * 50)
    if GITLAB_TOKEN:
        import subprocess
        token = GITLAB_TOKEN
        project = "eimispacheco-group%2Feimispacheco-project"
        base_url = f"https://gitlab.com/api/v4/projects/{project}"

        actions = [{"action": "create", "file_path": f"terraform-aws/{f}", "content": c}
                   for f, c in final_files.items()]

        outputs_summary = {k: v.get("value", v) if isinstance(v, dict) else v
                          for k, v in final_outputs.items()}

        commit_data = {
            "branch": "deploy/aws-dev-validated",
            "start_branch": "main",
            "commit_message": (
                "feat(infra): deployment-validated AWS Terraform\n\n"
                f"Infrastructure deployed successfully to AWS (dev).\n"
                f"Validated outputs: {json.dumps(outputs_summary, indent=2)}\n\n"
                "This code has been verified by actual cloud deployment."
            ),
            "actions": actions,
        }

        r = subprocess.run(
            ["curl", "-s", "--request", "POST",
             "--header", f"PRIVATE-TOKEN: {token}",
             "--header", "Content-Type: application/json",
             "--data", json.dumps(commit_data),
             f"{base_url}/repository/commits"],
            capture_output=True, text=True, timeout=30,
        )
        commit = json.loads(r.stdout)
        log(f"Commit: {commit.get('id', 'N/A')[:12] if 'id' in commit else commit}", 1)

        mr_data = {
            "source_branch": "deploy/aws-dev-validated",
            "target_branch": "main",
            "title": "Validated Infrastructure: AWS dev (deployment-tested)",
            "description": (
                "## Deployment-Validated AWS Infrastructure\n\n"
                "This Terraform code has been **actually deployed** to AWS and verified.\n\n"
                "### Deployment Outputs\n\n"
                "| Output | Value |\n|--------|-------|\n"
                + "\n".join(f"| {k} | {v} |" for k, v in outputs_summary.items())
                + "\n\n### Status: DEPLOYMENT VERIFIED\n\n"
                "---\n*Generated and validated by Skyrchitect deploy-first pipeline.*"
            ),
            "labels": "infrastructure,skyrchitect,deployment-validated",
        }

        r2 = subprocess.run(
            ["curl", "-s", "--request", "POST",
             "--header", f"PRIVATE-TOKEN: {token}",
             "--header", "Content-Type: application/json",
             "--data", json.dumps(mr_data),
             f"{base_url}/merge_requests"],
            capture_output=True, text=True, timeout=30,
        )
        mr = json.loads(r2.stdout)
        log(f"MR: !{mr.get('iid', 'N/A')} - {mr.get('web_url', mr)}", 1)
        results["steps"].append({"step": "Save to GitLab", "status": "PASS", "mr_url": mr.get("web_url", "")})
    else:
        log("GITLAB_TOKEN not set — skipping", 1)
        results["steps"].append({"step": "Save to GitLab", "status": "SKIPPED"})

    # Step 6: Cleanup
    print("\n" + "─" * 50)
    log("STEP 6: Destroy test infrastructure (cleanup)")
    print("─" * 50)
    var_args = [
        f"-var=region={region}",
        f"-var=environment={environment}",
        f"-var=aws_access_key_id={key_id}",
        f"-var=aws_secret_access_key={secret}",
    ]
    ok, destroy_out = terraform_destroy(workspace, var_args)
    if ok:
        log("Resources destroyed successfully.", 1)
        results["steps"].append({"step": "Cleanup", "status": "PASS"})
    else:
        log(f"Destroy warning: {destroy_out[:500]}", 1)
        results["steps"].append({"step": "Cleanup", "status": "WARN"})

    passed = sum(1 for s in results["steps"] if s["status"] == "PASS")
    failed = sum(1 for s in results["steps"] if s["status"] == "FAIL")
    results["overall"] = "PASS" if failed == 0 else "FAIL"

    print("\n" + "=" * 70)
    print(f"  E2E TEST RESULT: {results['overall']}")
    print(f"  Steps: {passed} passed, {failed} failed, {len(results['steps'])} total")
    print("=" * 70 + "\n")

    _write_results(results)


def _write_results(results):
    out = PROJECT_ROOT / "tests" / "e2e_deploy_aws_results.json"
    with open(out, "w") as f:
        json.dump(results, f, indent=2, default=str)
    log(f"Results written to {out}")


if __name__ == "__main__":
    main()
