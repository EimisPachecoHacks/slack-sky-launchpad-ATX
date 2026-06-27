"""Save deployment-validated Terraform code to GitLab."""

import json
import subprocess
import urllib.parse

from .config import GITLAB_API_BASE


class GitLabSaver:
    def __init__(self, token: str, project_path: str):
        self.token = token
        self.project_path = urllib.parse.quote(project_path, safe="")
        self.base_url = f"{GITLAB_API_BASE}/projects/{self.project_path}"

    def save_validated_deployment(
        self,
        files: dict[str, str],
        provider: str,
        environment: str,
        deployment_outputs: dict,
    ) -> dict:
        """Save deployment-validated IaC files to GitLab via a new branch + MR."""
        branch_name = f"deploy/{provider}-{environment}-validated"

        actions = []
        for filename, content in files.items():
            path = f"terraform-{provider}/{filename}"
            existing = self._file_exists(path)
            actions.append({
                "action": "update" if existing else "create",
                "file_path": path,
                "content": content,
            })

        commit_result = self._create_commit(
            branch=branch_name,
            message=(
                f"feat(infra): deployment-validated {provider.upper()} Terraform\n\n"
                f"Infrastructure deployed successfully to {provider.upper()} "
                f"({environment}).\n"
                f"Validated outputs: {json.dumps(deployment_outputs, indent=2)}\n\n"
                "This code has been verified by actual cloud deployment."
            ),
            actions=actions,
        )

        mr_result = self._create_merge_request(
            source_branch=branch_name,
            title=f"Validated Infrastructure: {provider.upper()} {environment}",
            description=self._build_mr_description(
                provider, environment, files, deployment_outputs
            ),
        )

        return {
            "commit": commit_result,
            "merge_request": mr_result,
            "branch": branch_name,
        }

    def _create_commit(self, branch: str, message: str, actions: list) -> dict:
        data = {
            "branch": branch,
            "start_branch": "main",
            "commit_message": message,
            "actions": actions,
        }
        return self._api_post("/repository/commits", data)

    def _create_merge_request(
        self, source_branch: str, title: str, description: str
    ) -> dict:
        data = {
            "source_branch": source_branch,
            "target_branch": "main",
            "title": title,
            "description": description,
            "labels": "infrastructure,skyrchitect,deployment-validated",
        }
        return self._api_post("/merge_requests", data)

    def _file_exists(self, path: str) -> bool:
        encoded = urllib.parse.quote(path, safe="")
        try:
            self._api_get(f"/repository/files/{encoded}?ref=main")
            return True
        except Exception:
            return False

    def _build_mr_description(
        self, provider: str, env: str, files: dict, outputs: dict
    ) -> str:
        output_lines = "\n".join(
            f"| `{k}` | `{v.get('value', v) if isinstance(v, dict) else v}` |"
            for k, v in outputs.items()
        )
        file_list = "\n".join(f"- `terraform-{provider}/{f}`" for f in files)

        return f"""\
## Deployment-Validated Infrastructure

This Terraform code has been **actually deployed** to {provider.upper()} and verified.

### Deployment Outputs

| Output | Value |
|--------|-------|
{output_lines}

### Files

{file_list}

### Environment: `{env}`
### Provider: `{provider.upper()}`
### Status: Deployment VERIFIED

---
*Generated and validated by Skyrchitect deploy-first pipeline.*
"""

    def _api_post(self, endpoint: str, data: dict) -> dict:
        url = f"{self.base_url}{endpoint}"
        try:
            result = subprocess.run(
                ["curl", "-s", "--request", "POST",
                 "--header", f"PRIVATE-TOKEN: {self.token}",
                 "--header", "Content-Type: application/json",
                 "--data", json.dumps(data),
                 url],
                capture_output=True, text=True, timeout=30,
            )
            return json.loads(result.stdout)
        except Exception as e:
            return {"error": str(e)}

    def _api_get(self, endpoint: str) -> dict:
        url = f"{self.base_url}{endpoint}"
        try:
            result = subprocess.run(
                ["curl", "-s", "--header", f"PRIVATE-TOKEN: {self.token}", url],
                capture_output=True, text=True, timeout=30,
            )
            return json.loads(result.stdout)
        except Exception as e:
            return {"error": str(e)}
