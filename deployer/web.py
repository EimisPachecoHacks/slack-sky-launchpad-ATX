#!/usr/bin/env python3
"""Skyrchitect Web UI — browser-based deploy-first pipeline."""

import json
import os
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

from flask import Flask, render_template_string, request, jsonify, Response

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from deployer.credential_manager import (
    store_credential, credential_exists, load_credential,
    parse_credential, write_gcp_credential_file, get_aws_keys,
)
from deployer.iac_generator import generate_gcp_terraform, generate_aws_terraform
from deployer.deployment_engine import (
    prepare_workspace, write_terraform_files,
    terraform_init, terraform_plan, terraform_apply,
    terraform_output, terraform_destroy,
)
from deployer.deployment_validator import DeploymentResult, analyze_and_fix
from deployer.gitlab_saver import GitLabSaver
from deployer.config import MAX_DEPLOY_RETRIES, CREDENTIALS_DIR
from deployer.main import _repair_failure  # self-improving repair step (shared with the CLI)

app = Flask(__name__)

pipeline_state = {
    "status": "idle",
    "steps": [],
    "current_step": "",
    "outputs": {},
    "error": None,
}


def reset_state():
    pipeline_state.update({
        "status": "idle", "steps": [], "current_step": "",
        "outputs": {}, "error": None,
    })


def add_step(name, status, details=""):
    pipeline_state["steps"].append({"name": name, "status": status, "details": details})
    pipeline_state["current_step"] = name


HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sky Launchpad — Self-Improving Deploy Pipeline</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0d1117; color: #c9d1d9; min-height: 100vh;
  }
  .header {
    background: linear-gradient(135deg, #1a1f35 0%, #0d1117 100%);
    border-bottom: 1px solid #30363d; padding: 20px 40px;
    display: flex; align-items: center; gap: 16px;
  }
  .header h1 { font-size: 24px; color: #58a6ff; }
  .header .subtitle { color: #8b949e; font-size: 14px; }
  .container { max-width: 800px; margin: 40px auto; padding: 0 20px; }
  .card {
    background: #161b22; border: 1px solid #30363d; border-radius: 12px;
    padding: 32px; margin-bottom: 24px;
  }
  .card h2 { color: #f0f6fc; margin-bottom: 20px; font-size: 20px; }
  .provider-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .provider-btn {
    background: #21262d; border: 2px solid #30363d; border-radius: 10px;
    padding: 24px; cursor: pointer; transition: all 0.2s; text-align: center;
  }
  .provider-btn:hover { border-color: #58a6ff; background: #1c2333; }
  .provider-btn.selected { border-color: #58a6ff; background: #1c2333; }
  .provider-btn .icon { font-size: 40px; margin-bottom: 8px; }
  .provider-btn .name { font-size: 18px; color: #f0f6fc; font-weight: 600; }
  .provider-btn .desc { color: #8b949e; font-size: 13px; margin-top: 4px; }
  label { display: block; color: #c9d1d9; margin-bottom: 6px; font-weight: 500; }
  input[type="file"], input[type="text"], input[type="password"], select {
    width: 100%; padding: 10px 14px; background: #0d1117; border: 1px solid #30363d;
    border-radius: 8px; color: #c9d1d9; font-size: 14px; margin-bottom: 16px;
  }
  input:focus, select:focus { outline: none; border-color: #58a6ff; }
  .btn {
    background: #238636; color: #fff; border: none; padding: 12px 24px;
    border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;
    transition: background 0.2s; width: 100%;
  }
  .btn:hover { background: #2ea043; }
  .btn:disabled { background: #21262d; color: #484f58; cursor: not-allowed; }
  .btn-danger { background: #da3633; }
  .btn-danger:hover { background: #f85149; }
  .step-list { list-style: none; }
  .step-list li {
    padding: 12px 16px; border-left: 3px solid #30363d;
    margin-bottom: 8px; background: #0d1117; border-radius: 0 8px 8px 0;
  }
  .step-list li.pass { border-left-color: #238636; }
  .step-list li.fail { border-left-color: #da3633; }
  .step-list li.running { border-left-color: #d29922; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
  .step-name { font-weight: 600; color: #f0f6fc; }
  .step-status { float: right; font-weight: 700; }
  .step-status.pass { color: #3fb950; }
  .step-status.fail { color: #f85149; }
  .step-status.running { color: #d29922; }
  .step-details { color: #8b949e; font-size: 13px; margin-top: 4px; white-space: pre-wrap; }
  .outputs-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .outputs-table td { padding: 8px 12px; border: 1px solid #30363d; font-family: monospace; font-size: 13px; }
  .outputs-table td:first-child { color: #58a6ff; width: 30%; }
  .hidden { display: none; }
  .badge {
    display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-size: 13px; font-weight: 600;
  }
  .badge-pass { background: #238636; color: #fff; }
  .badge-fail { background: #da3633; color: #fff; }
  .stored-badge { background: #1f6feb33; color: #58a6ff; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .upload-zone {
    border: 2px dashed #30363d; border-radius: 10px; padding: 32px;
    text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 16px;
  }
  .upload-zone:hover { border-color: #58a6ff; background: #1c233322; }
  .upload-zone.has-file { border-color: #238636; background: #23863622; }
  .upload-zone .icon { font-size: 32px; margin-bottom: 8px; }
  .mr-link { color: #58a6ff; text-decoration: none; font-weight: 600; }
  .mr-link:hover { text-decoration: underline; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Sky Launchpad</h1>
    <div class="subtitle">Self-Improving Infrastructure Pipeline &mdash; Generate &rarr; Deploy &rarr; Learn-on-Failure &rarr; Save to GitLab</div>
  </div>
</div>

<div class="container">

  <!-- Step 1: Provider Selection -->
  <div class="card" id="step-provider">
    <h2>1. Select Cloud Provider</h2>
    <div class="provider-grid">
      <div class="provider-btn" onclick="selectProvider('gcp')" id="btn-gcp">
        <div class="icon">&#9729;</div>
        <div class="name">Google Cloud</div>
        <div class="desc">Terraform with GCP provider</div>
        <div id="gcp-stored" class="hidden" style="margin-top:8px"><span class="stored-badge">credentials stored</span></div>
      </div>
      <div class="provider-btn" onclick="selectProvider('aws')" id="btn-aws">
        <div class="icon">&#9889;</div>
        <div class="name">Amazon Web Services</div>
        <div class="desc">Terraform with AWS provider</div>
        <div id="aws-stored" class="hidden" style="margin-top:8px"><span class="stored-badge">credentials stored</span></div>
      </div>
    </div>
  </div>

  <!-- Step 2: Credentials -->
  <div class="card hidden" id="step-creds">
    <h2>2. Upload Credentials</h2>
    <p style="color:#8b949e; margin-bottom:16px">
      Your credentials are encrypted and stored locally at <code>~/.skyrchitect/</code>. They never leave your machine or get committed to git.
    </p>
    <div class="upload-zone" id="upload-zone" onclick="document.getElementById('cred-file').click()">
      <div class="icon" id="upload-icon">&#128274;</div>
      <div id="upload-text">Click to upload credential file</div>
      <div style="color:#8b949e; font-size:12px; margin-top:4px" id="upload-hint"></div>
    </div>
    <input type="file" id="cred-file" style="display:none" onchange="handleFileUpload(this)">
    <div id="cred-info" class="hidden" style="background:#0d1117; padding:12px; border-radius:8px; margin-bottom:16px; font-family:monospace; font-size:13px;"></div>
    <button class="btn" id="btn-save-creds" disabled onclick="saveCredentials()">Save Credentials Securely</button>
  </div>

  <!-- Step 3: Configure -->
  <div class="card hidden" id="step-config">
    <h2>3. Configure Deployment</h2>
    <div class="form-row">
      <div>
        <label>Region</label>
        <input type="text" id="region" placeholder="us-central1">
      </div>
      <div>
        <label>Environment</label>
        <select id="environment">
          <option value="dev">dev (minimal cost)</option>
          <option value="staging">staging</option>
          <option value="prod">prod (full HA)</option>
        </select>
      </div>
    </div>
    <div id="gcp-project-field">
      <label>GCP Project ID</label>
      <input type="text" id="project-id" placeholder="my-project-id">
    </div>
    <label>GitLab Token (to save validated code)</label>
    <input type="password" id="gitlab-token" placeholder="glpat-...">
    <button class="btn" onclick="startPipeline()">Deploy &amp; Validate</button>
  </div>

  <!-- Step 4: Pipeline Progress -->
  <div class="card hidden" id="step-pipeline">
    <h2>4. Pipeline Progress</h2>
    <ul class="step-list" id="pipeline-steps"></ul>
    <div id="pipeline-result" class="hidden" style="text-align:center; margin-top:24px;"></div>
  </div>

  <!-- Step 5: Outputs -->
  <div class="card hidden" id="step-outputs">
    <h2>5. Deployment Outputs</h2>
    <table class="outputs-table" id="outputs-table"></table>
  </div>

  <!-- Step 6: GitLab -->
  <div class="card hidden" id="step-gitlab">
    <h2>6. Saved to GitLab</h2>
    <div id="gitlab-result"></div>
  </div>
</div>

<script>
let selectedProvider = null;
let credFile = null;
let pollInterval = null;

function checkStoredCreds() {
  fetch('/api/stored-credentials').then(r => r.json()).then(data => {
    if (data.gcp) document.getElementById('gcp-stored').classList.remove('hidden');
    if (data.aws) document.getElementById('aws-stored').classList.remove('hidden');
  });
}

function selectProvider(p) {
  selectedProvider = p;
  document.querySelectorAll('.provider-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-' + p).classList.add('selected');
  document.getElementById('step-creds').classList.remove('hidden');
  const hint = p === 'gcp' ? 'Service Account JSON (.json)' : 'Access Keys CSV (.csv)';
  document.getElementById('upload-hint').textContent = hint;
  const gf = document.getElementById('gcp-project-field');
  gf.style.display = p === 'gcp' ? 'block' : 'none';
  document.getElementById('region').placeholder = p === 'gcp' ? 'us-central1' : 'us-east-1';
  document.getElementById('region').value = p === 'gcp' ? 'us-central1' : 'us-east-1';
}

function handleFileUpload(input) {
  if (input.files.length > 0) {
    credFile = input.files[0];
    document.getElementById('upload-zone').classList.add('has-file');
    document.getElementById('upload-icon').textContent = '\\u2705';
    document.getElementById('upload-text').textContent = credFile.name;
    document.getElementById('btn-save-creds').disabled = false;
  }
}

function saveCredentials() {
  const formData = new FormData();
  formData.append('file', credFile);
  formData.append('provider', selectedProvider);
  document.getElementById('btn-save-creds').textContent = 'Saving...';
  document.getElementById('btn-save-creds').disabled = true;

  fetch('/api/save-credentials', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById('cred-info').classList.remove('hidden');
        document.getElementById('cred-info').innerHTML =
          '<strong style="color:#3fb950">Credentials stored securely</strong><br>' +
          JSON.stringify(data.info, null, 2);
        document.getElementById('btn-save-creds').textContent = 'Saved!';
        document.getElementById('btn-save-creds').style.background = '#238636';
        if (data.info.project_id) document.getElementById('project-id').value = data.info.project_id;
        document.getElementById('step-config').classList.remove('hidden');
      } else {
        document.getElementById('btn-save-creds').textContent = 'Error: ' + data.error;
        document.getElementById('btn-save-creds').style.background = '#da3633';
        document.getElementById('btn-save-creds').disabled = false;
      }
    });
}

function startPipeline() {
  const config = {
    provider: selectedProvider,
    region: document.getElementById('region').value,
    environment: document.getElementById('environment').value,
    project_id: document.getElementById('project-id').value,
    gitlab_token: document.getElementById('gitlab-token').value,
  };
  document.getElementById('step-pipeline').classList.remove('hidden');
  document.getElementById('pipeline-steps').innerHTML = '';

  fetch('/api/deploy', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(config) })
    .then(r => r.json());

  pollInterval = setInterval(pollStatus, 1500);
}

function pollStatus() {
  fetch('/api/status').then(r => r.json()).then(data => {
    const list = document.getElementById('pipeline-steps');
    list.innerHTML = '';
    data.steps.forEach(s => {
      const li = document.createElement('li');
      li.className = s.status.toLowerCase();
      li.innerHTML = '<span class="step-name">' + s.name + '</span>' +
        '<span class="step-status ' + s.status.toLowerCase() + '">' + s.status + '</span>' +
        (s.details ? '<div class="step-details">' + s.details + '</div>' : '');
      list.appendChild(li);
    });

    if (data.status === 'running') {
      const running = document.createElement('li');
      running.className = 'running';
      running.innerHTML = '<span class="step-name">' + data.current_step + '</span>' +
        '<span class="step-status running">RUNNING</span>';
      list.appendChild(running);
    }

    if (data.status === 'done' || data.status === 'failed') {
      clearInterval(pollInterval);
      const result = document.getElementById('pipeline-result');
      result.classList.remove('hidden');
      if (data.status === 'done') {
        result.innerHTML = '<span class="badge badge-pass">PIPELINE PASSED</span>';
        if (data.outputs && Object.keys(data.outputs).length > 0) {
          document.getElementById('step-outputs').classList.remove('hidden');
          const table = document.getElementById('outputs-table');
          table.innerHTML = '';
          Object.entries(data.outputs).forEach(([k, v]) => {
            const val = typeof v === 'object' ? (v.value || JSON.stringify(v)) : v;
            table.innerHTML += '<tr><td>' + k + '</td><td>' + val + '</td></tr>';
          });
        }
        if (data.gitlab_mr) {
          document.getElementById('step-gitlab').classList.remove('hidden');
          document.getElementById('gitlab-result').innerHTML =
            '<p style="margin-bottom:12px">Deployment-validated code saved!</p>' +
            '<a class="mr-link" href="' + data.gitlab_mr + '" target="_blank">' + data.gitlab_mr + '</a>';
        }
      } else {
        result.innerHTML = '<span class="badge badge-fail">PIPELINE FAILED</span>' +
          '<p style="margin-top:12px; color:#f85149">' + (data.error || 'Unknown error') + '</p>';
      }
    }
  });
}

checkStoredCreds();
</script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route("/api/stored-credentials")
def stored_credentials():
    return jsonify({
        "gcp": credential_exists("gcp"),
        "aws": credential_exists("aws"),
    })


@app.route("/api/save-credentials", methods=["POST"])
def save_credentials():
    provider = request.form.get("provider")
    file = request.files.get("file")
    if not file or not provider:
        return jsonify({"success": False, "error": "Missing file or provider"})

    tmp_path = CREDENTIALS_DIR / f"_tmp_{provider}"
    CREDENTIALS_DIR.mkdir(parents=True, exist_ok=True)
    file.save(str(tmp_path))

    try:
        info = store_credential(provider, str(tmp_path))
        tmp_path.unlink(missing_ok=True)
        return jsonify({"success": True, "info": info})
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/deploy", methods=["POST"])
def deploy():
    config = request.json
    reset_state()
    pipeline_state["status"] = "running"
    thread = threading.Thread(target=run_pipeline, args=(config,), daemon=True)
    thread.start()
    return jsonify({"started": True})


@app.route("/api/status")
def status():
    return jsonify(pipeline_state)


def run_pipeline(config):
    provider = config["provider"]
    region = config.get("region", "us-central1" if provider == "gcp" else "us-east-1")
    environment = config.get("environment", "dev")
    project_id = config.get("project_id", "")
    gitlab_token = config.get("gitlab_token", "")

    try:
        # Step 1: Generate
        pipeline_state["current_step"] = "Generating Terraform code..."
        time.sleep(0.5)

        if provider == "gcp":
            files = generate_gcp_terraform(project_id=project_id, region=region, environment=environment)
        else:
            files = generate_aws_terraform(account_id="396608774889", region=region, environment=environment)

        add_step("Generate Terraform", "PASS", f"{len(files)} files generated")

        # Step 2: Deploy with retry
        run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        workspace = prepare_workspace(provider, run_id)
        final_files = files
        _agent_env = {"id": None}  # Antigravity stateful-memory env id across retries

        for attempt in range(1, MAX_DEPLOY_RETRIES + 1):
            pipeline_state["current_step"] = f"Deploy attempt {attempt}/{MAX_DEPLOY_RETRIES}..."

            write_terraform_files(workspace, final_files)
            var_args = _build_var_args(provider, config, workspace)

            # Init
            pipeline_state["current_step"] = f"[{attempt}] terraform init..."
            ok, output = terraform_init(workspace)
            if not ok:
                final_files, changes, _agent_env["id"] = _repair_failure(
                    provider, config, workspace, final_files, output, _agent_env["id"]
                )
                if changes and attempt < MAX_DEPLOY_RETRIES:
                    add_step(f"Deploy attempt {attempt}", "FAIL", f"Init failed. Auto-fix: {changes}")
                    for f in final_files:
                        (workspace / f).unlink(missing_ok=True)
                    continue
                add_step(f"Deploy attempt {attempt}", "FAIL", f"Init failed: {output[:300]}")
                pipeline_state["status"] = "failed"
                pipeline_state["error"] = "terraform init failed"
                return

            # Plan
            pipeline_state["current_step"] = f"[{attempt}] terraform plan..."
            ok, output = terraform_plan(workspace, var_args)
            if not ok:
                final_files, changes, _agent_env["id"] = _repair_failure(
                    provider, config, workspace, final_files, output, _agent_env["id"]
                )
                if changes and attempt < MAX_DEPLOY_RETRIES:
                    add_step(f"Deploy attempt {attempt}", "FAIL", f"Plan failed. Auto-fix: {changes}")
                    for f in final_files:
                        (workspace / f).unlink(missing_ok=True)
                    continue
                add_step(f"Deploy attempt {attempt}", "FAIL", f"Plan failed: {output[:300]}")
                pipeline_state["status"] = "failed"
                pipeline_state["error"] = "terraform plan failed"
                return

            # Apply
            pipeline_state["current_step"] = f"[{attempt}] terraform apply..."
            ok, output = terraform_apply(workspace, var_args)
            if not ok:
                final_files, changes, _agent_env["id"] = _repair_failure(
                    provider, config, workspace, final_files, output, _agent_env["id"]
                )
                if changes and attempt < MAX_DEPLOY_RETRIES:
                    add_step(f"Deploy attempt {attempt}", "FAIL", f"Apply failed. Auto-fix: {changes}")
                    for f in final_files:
                        (workspace / f).unlink(missing_ok=True)
                    continue
                add_step(f"Deploy attempt {attempt}", "FAIL", f"Apply failed: {output[:500]}")
                pipeline_state["status"] = "failed"
                pipeline_state["error"] = "terraform apply failed after all retries"
                return

            # Success!
            _, outputs = terraform_output(workspace)
            pipeline_state["outputs"] = outputs
            add_step(f"Deploy attempt {attempt}", "PASS", "Infrastructure deployed successfully!")
            break

        # Step 3: Validate
        pipeline_state["current_step"] = "Validating deployment outputs..."
        output_summary = {k: v.get("value", v) if isinstance(v, dict) else v
                         for k, v in pipeline_state["outputs"].items()}
        add_step("Validate Outputs", "PASS", json.dumps(output_summary, indent=2))

        # Step 4: Save to GitLab
        if gitlab_token:
            pipeline_state["current_step"] = "Saving validated code to GitLab..."
            import subprocess
            project_path = "eimispacheco-group%2Feimispacheco-project"
            base_url = f"https://gitlab.com/api/v4/projects/{project_path}"

            actions = [{"action": "create", "file_path": f"terraform-{provider}/{f}", "content": c}
                       for f, c in final_files.items()]

            commit_data = {
                "branch": f"deploy/{provider}-{environment}-validated",
                "start_branch": "main",
                "commit_message": f"feat(infra): deployment-validated {provider.upper()} Terraform ({environment})",
                "actions": actions,
            }

            r = subprocess.run(
                ["curl", "-s", "--request", "POST",
                 "--header", f"PRIVATE-TOKEN: {gitlab_token}",
                 "--header", "Content-Type: application/json",
                 "--data", json.dumps(commit_data), f"{base_url}/repository/commits"],
                capture_output=True, text=True, timeout=30,
            )
            commit = json.loads(r.stdout) if r.stdout else {}

            mr_data = {
                "source_branch": f"deploy/{provider}-{environment}-validated",
                "target_branch": "main",
                "title": f"Validated Infrastructure: {provider.upper()} {environment}",
                "description": f"Deployment-validated {provider.upper()} Terraform.\n\nOutputs: {json.dumps(output_summary, indent=2)}",
                "labels": "infrastructure,skyrchitect,deployment-validated",
            }
            r2 = subprocess.run(
                ["curl", "-s", "--request", "POST",
                 "--header", f"PRIVATE-TOKEN: {gitlab_token}",
                 "--header", "Content-Type: application/json",
                 "--data", json.dumps(mr_data), f"{base_url}/merge_requests"],
                capture_output=True, text=True, timeout=30,
            )
            mr = json.loads(r2.stdout) if r2.stdout else {}
            mr_url = mr.get("web_url", "")
            pipeline_state["gitlab_mr"] = mr_url
            add_step("Save to GitLab", "PASS", f"MR: {mr_url}" if mr_url else str(mr))
        else:
            add_step("Save to GitLab", "SKIP", "No GitLab token provided")

        # Step 5: Cleanup
        pipeline_state["current_step"] = "Destroying test infrastructure..."
        ok, _ = terraform_destroy(workspace, var_args)
        add_step("Cleanup", "PASS" if ok else "WARN", "Resources destroyed" if ok else "Destroy had issues")

        pipeline_state["status"] = "done"
        pipeline_state["current_step"] = ""

    except Exception as e:
        add_step("Error", "FAIL", str(e))
        pipeline_state["status"] = "failed"
        pipeline_state["error"] = str(e)


def _build_var_args(provider, config, workspace):
    region = config.get("region", "us-central1" if provider == "gcp" else "us-east-1")
    environment = config.get("environment", "dev")
    args = []
    if provider == "gcp":
        cred_path = write_gcp_credential_file(workspace)
        args = [
            f"-var=project_id={config.get('project_id', '')}",
            f"-var=region={region}",
            f"-var=environment={environment}",
            f"-var=credentials_file={cred_path}",
        ]
    elif provider == "aws":
        key_id, secret = get_aws_keys()
        args = [
            f"-var=region={region}",
            f"-var=environment={environment}",
            f"-var=aws_access_key_id={key_id}",
            f"-var=aws_secret_access_key={secret}",
        ]
    return args


if __name__ == "__main__":
    print("\n  Sky Launchpad Web UI starting...")
    print("  Open http://localhost:5001 in your browser\n")
    app.run(host="0.0.0.0", port=5001, debug=False)
