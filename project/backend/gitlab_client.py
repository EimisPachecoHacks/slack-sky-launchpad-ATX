"""
GitLab Duo Agent Platform — API Client

Mirrors the three-agent pipeline defined in flows/skyrchitect-iac-generator.yaml:
  1. Requirements Analyzer  → create_issue (captures structured requirements)
  2. IaC Generator          → (handled by Gemma 3 + Skills context)
  3. Code Committer         → create_commit + create_merge_request + add_issue_note

Uses the same GitLab REST API endpoints that the Duo Flow agents use internally
(create_commit, create_merge_request, create_issue_note, get_issue, etc.).
"""

import json
import logging
import os
import urllib.parse
from datetime import datetime
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_GITLAB_URL = os.getenv("GITLAB_URL", "https://gitlab.com")
_API_V4 = f"{_GITLAB_URL}/api/v4"


class GitLabClient:
    """Thin wrapper around the GitLab v4 REST API."""

    def __init__(
        self,
        token: Optional[str] = None,
        project_path: Optional[str] = None,
    ):
        self.token = token or os.getenv("GITLAB_TOKEN", "")
        raw_path = project_path or os.getenv("GITLAB_PROJECT_PATH", "")
        self.project_path = raw_path
        self.project_id = urllib.parse.quote(raw_path, safe="")
        self.base = f"{_API_V4}/projects/{self.project_id}"
        self.headers = {
            "PRIVATE-TOKEN": self.token,
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Agent 1 — Requirements Analyzer: issue helpers
    # ------------------------------------------------------------------

    def create_issue(
        self,
        title: str,
        description: str,
        labels: str = "infrastructure,skyrchitect",
    ) -> dict:
        """Create a GitLab issue (triggers Duo Flow via issue event)."""
        data = {
            "title": title,
            "description": description,
            "labels": labels,
        }
        return self._post("/issues", data)

    def add_issue_note(self, issue_iid: int, body: str) -> dict:
        """Add a comment to an issue."""
        return self._post(f"/issues/{issue_iid}/notes", {"body": body})

    def get_issue(self, issue_iid: int) -> dict:
        return self._get(f"/issues/{issue_iid}")

    # ------------------------------------------------------------------
    # Agent 3 — Code Committer: branch / commit / MR helpers
    # ------------------------------------------------------------------

    def create_branch(self, branch_name: str, ref: str = "main") -> dict:
        return self._post(
            "/repository/branches",
            {"branch": branch_name, "ref": ref},
        )

    def create_commit(
        self,
        branch: str,
        message: str,
        actions: list[dict],
        start_branch: str = "main",
    ) -> dict:
        """Create a commit with file actions (same API the Duo agent uses)."""
        data = {
            "branch": branch,
            "start_branch": start_branch,
            "commit_message": message,
            "actions": actions,
        }
        return self._post("/repository/commits", data)

    def create_merge_request(
        self,
        source_branch: str,
        title: str,
        description: str,
        target_branch: str = "main",
        labels: str = "infrastructure,skyrchitect,deployment-validated",
    ) -> dict:
        data = {
            "source_branch": source_branch,
            "target_branch": target_branch,
            "title": title,
            "description": description,
            "labels": labels,
        }
        return self._post("/merge_requests", data)

    def file_exists(self, path: str, ref: str = "main") -> bool:
        encoded = urllib.parse.quote(path, safe="")
        resp = self._get(f"/repository/files/{encoded}?ref={ref}")
        return "file_name" in resp

    # ------------------------------------------------------------------
    # High-level workflow helpers (used by the deploy endpoint)
    # ------------------------------------------------------------------

    def save_validated_deployment(
        self,
        terraform_code: str,
        provider: str,
        environment: str,
        architecture_name: str,
        deployment_outputs: dict,
        issue_iid: Optional[int] = None,
    ) -> dict:
        """
        Code Committer step: save deployment-validated IaC to GitLab.

        Creates a branch, commits the Terraform files, opens a merge request,
        and (optionally) comments on the tracking issue.
        """
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        branch_name = f"deploy/{provider}-{environment}-validated-{ts}"
        file_path = f"terraform-{provider}/main.tf"

        action = "update" if self.file_exists(file_path) else "create"

        actions = [
            {
                "action": action,
                "file_path": file_path,
                "content": terraform_code,
            }
        ]

        commit_msg = (
            f"feat(infra): deployment-validated {provider.upper()} Terraform\n\n"
            f"Architecture: {architecture_name}\n"
            f"Environment: {environment}\n"
            f"Infrastructure deployed and verified on {provider.upper()}.\n\n"
            f"Validated outputs:\n{json.dumps(deployment_outputs, indent=2)}\n\n"
            "Generated and validated by Skyrchitect deploy-first pipeline.\n"
            "Built on the GitLab Duo Agent Platform."
        )
        if issue_iid:
            commit_msg += f"\n\nCloses #{issue_iid}"

        commit_result = self.create_commit(
            branch=branch_name,
            message=commit_msg,
            actions=actions,
        )
        logger.info(f"GitLab commit result: {json.dumps(commit_result)[:300]}")

        mr_description = self._build_mr_description(
            provider, environment, architecture_name, terraform_code, deployment_outputs, issue_iid
        )
        mr_title = f"Validated Infrastructure: {architecture_name} ({provider.upper()} {environment})"

        mr_result = self.create_merge_request(
            source_branch=branch_name,
            title=mr_title,
            description=mr_description,
        )
        logger.info(f"GitLab MR result: {json.dumps(mr_result)[:300]}")

        mr_url = mr_result.get("web_url", "")

        if issue_iid:
            note = (
                f"**Skyrchitect Code Committer** has saved deployment-validated "
                f"Terraform code.\n\n"
                f"- **Provider:** {provider.upper()}\n"
                f"- **Environment:** {environment}\n"
                f"- **Merge Request:** {mr_url}\n"
                f"- **Status:** Deployment VERIFIED\n\n"
                f"_Automated by Skyrchitect deploy-first pipeline — "
                f"GitLab Duo Agent Platform._"
            )
            self.add_issue_note(issue_iid, note)

        return {
            "branch": branch_name,
            "commit": commit_result,
            "merge_request": mr_result,
            "mr_url": mr_url,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_mr_description(
        self,
        provider: str,
        env: str,
        arch_name: str,
        code: str,
        outputs: dict,
        issue_iid: Optional[int],
    ) -> str:
        output_lines = "\n".join(
            f"| `{k}` | `{v.get('value', v) if isinstance(v, dict) else v}` |"
            for k, v in outputs.items()
        ) if outputs else "| _none_ | _deployment succeeded_ |"

        code_preview = code[:2000] + "\n..." if len(code) > 2000 else code
        issue_ref = f"\n\nCloses #{issue_iid}" if issue_iid else ""

        return f"""\
## Deployment-Validated Infrastructure

> This Terraform code has been **actually deployed** to {provider.upper()} and verified.

### Architecture
**{arch_name}**

### Deployment Outputs

| Output | Value |
|--------|-------|
{output_lines}

### Files

- `terraform-{provider}/main.tf`

### Code Preview

```hcl
{code_preview}
```

### Environment: `{env}`
### Provider: `{provider.upper()}`
### Status: Deployment VERIFIED

---
*Generated and validated by Skyrchitect deploy-first pipeline.*
*Built on the [GitLab Duo Agent Platform](https://docs.gitlab.com/ee/user/duo_workflow/).*{issue_ref}
"""

    def _post(self, endpoint: str, data: dict) -> dict:
        url = f"{self.base}{endpoint}"
        try:
            resp = requests.post(url, headers=self.headers, json=data, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.HTTPError as e:
            body = e.response.text[:500] if e.response is not None else str(e)
            logger.error(f"GitLab POST {endpoint} failed: {e} — {body}")
            return {"error": str(e), "detail": body}
        except Exception as e:
            logger.error(f"GitLab POST {endpoint} error: {e}")
            return {"error": str(e)}

    def _get(self, endpoint: str) -> dict:
        url = f"{self.base}{endpoint}"
        try:
            resp = requests.get(url, headers=self.headers, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {}
