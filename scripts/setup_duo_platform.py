#!/usr/bin/env python3
"""
Skyrchitect — GitLab Duo Agent Platform Setup Script

This script automates the creation of:
1. Custom Agent (Skyrchitect) via GraphQL
2. Custom Flow trigger via Flows API
3. Enables the agent in the project

Prerequisites:
- GitLab Ultimate trial must be active (Settings > Billing > Start free trial)
- GITLAB_TOKEN env var must be set with api-scoped PAT
- GITLAB_PROJECT_PATH env var must be set (e.g., eimispacheco-group/eimispacheco-project)
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

GITLAB_URL = os.getenv("GITLAB_URL", "https://gitlab.com")
GITLAB_TOKEN = os.getenv("GITLAB_TOKEN", "")
GITLAB_PROJECT_PATH = os.getenv("GITLAB_PROJECT_PATH", "")

REPO_ROOT = Path(__file__).resolve().parent.parent
FLOW_YAML_PATH = REPO_ROOT / "flows" / "skyrchitect-iac-generator.yaml"
AGENT_CONFIG_PATH = REPO_ROOT / "agents" / "skyrchitect-chat-agent.md"

AGENT_SYSTEM_PROMPT = """\
You are Skyrchitect, an expert Google Cloud Platform infrastructure architect and \
Terraform specialist. You help developers design, generate, and review cloud \
infrastructure.

Your capabilities:
1. Design GCP architectures based on requirements (compute, networking, databases, \
storage, serverless, containers, data pipelines)
2. Generate production-ready Terraform code following GCP best practices
3. Review existing Terraform configurations for security, cost, and quality issues
4. Explain architecture decisions and trade-offs
5. Estimate infrastructure costs
6. Suggest optimizations for existing infrastructure

When generating Terraform code:
- Always target GCP with the google provider (~> 5.0)
- Use GCS backend for remote state
- Apply security defaults: private IPs, least-privilege IAM, encryption
- Include cost estimation comments
- Generate complete file sets (providers.tf, main.tf, variables.tf, outputs.tf)
- Apply standard labels: environment, team, cost_center, managed_by=skyrchitect

When reviewing infrastructure:
- Check for security issues (public IPs on databases, overly permissive IAM)
- Validate cost efficiency (right-sized instances, lifecycle policies)
- Verify best practices (provider pinning, state backend, variable validation)
- Suggest improvements with specific Terraform code snippets

Communication style:
- Be specific and actionable
- Explain trade-offs between approaches
- Ask clarifying questions when requirements are ambiguous
- Reference cost estimates where possible
- Use code blocks for Terraform examples"""

AGENT_TOOLS = [
    "get_issue",
    "get_merge_request",
    "list_merge_request_diffs",
    "get_repository_file",
    "list_repository_tree",
    "gitlab_blob_search",
    "create_issue",
    "create_issue_note",
    "create_commit",
    "create_merge_request",
    "create_merge_request_note",
]


def graphql(query: str, variables: dict | None = None) -> dict:
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{GITLAB_URL}/api/graphql",
        data=data,
        headers={
            "PRIVATE-TOKEN": GITLAB_TOKEN,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def rest_api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{GITLAB_URL}/api/v4{path}"
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "PRIVATE-TOKEN": GITLAB_TOKEN,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def check_prerequisites():
    if not GITLAB_TOKEN:
        print("ERROR: GITLAB_TOKEN environment variable not set")
        sys.exit(1)
    if not GITLAB_PROJECT_PATH:
        print("ERROR: GITLAB_PROJECT_PATH environment variable not set")
        sys.exit(1)

    print(f"GitLab URL:     {GITLAB_URL}")
    print(f"Project:        {GITLAB_PROJECT_PATH}")
    print(f"Token:          {'*' * 20}...{GITLAB_TOKEN[-4:]}")
    print()

    ns_path = GITLAB_PROJECT_PATH.split("/")[0]
    ns_url = f"/namespaces/{urllib.parse.quote(ns_path, safe='')}"
    try:
        ns = rest_api("GET", ns_url)
        plan = ns.get("plan", "free")
        trial = ns.get("trial", False)
        print(f"Namespace plan: {plan}")
        print(f"Trial active:   {trial}")
        if plan == "free" and not trial:
            print()
            print("WARNING: GitLab Ultimate trial is NOT active.")
            print("   Go to: GitLab > Your Group > Settings > Billing > Start free trial")
            print("   This is required for Duo Agent Platform features.")
            return False
    except Exception as e:
        print(f"Could not check namespace: {e}")
    return True


def create_agent():
    print("\n--- Creating Custom Agent: Skyrchitect ---")

    result = graphql(
        """
        mutation CreateAgent($input: AiAgentCreateInput!) {
            aiAgentCreate(input: $input) {
                agent { id name }
                errors
            }
        }
        """,
        {
            "input": {
                "projectPath": GITLAB_PROJECT_PATH,
                "name": "Skyrchitect",
                "prompt": AGENT_SYSTEM_PROMPT,
            }
        },
    )

    if result.get("errors"):
        print(f"GraphQL errors: {json.dumps(result['errors'], indent=2)}")
        return None

    data = result.get("data", {}).get("aiAgentCreate", {})
    if data.get("errors"):
        print(f"Mutation errors: {data['errors']}")
        return None

    agent = data.get("agent", {})
    print(f"Agent created: {agent.get('name')} (ID: {agent.get('id')})")
    return agent


def trigger_flow(issue_iid: int | None = None):
    print("\n--- Triggering Custom Flow ---")

    project_id = urllib.parse.quote(GITLAB_PROJECT_PATH, safe="")
    project = rest_api("GET", f"/projects/{project_id}")
    project_numeric_id = project.get("id")

    flow_payload = {
        "project_id": str(project_numeric_id),
        "goal": "Generate GCP Terraform for a three-tier web application with VPC, Cloud SQL, and load balancer",
        "environment": "ambient",
        "start_workflow": True,
    }

    if issue_iid:
        flow_payload["issue_id"] = issue_iid

    result = rest_api("POST", "/ai/duo_workflows/workflows", flow_payload)
    print(f"Flow response: {json.dumps(result, indent=2)[:500]}")
    return result


def list_agents():
    print("\n--- Listing Agents ---")
    result = graphql(
        """
        query ($path: ID!) {
            project(fullPath: $path) {
                aiAgents { nodes { id name } }
            }
        }
        """,
        {"path": GITLAB_PROJECT_PATH},
    )
    agents = (
        result.get("data", {})
        .get("project", {})
        .get("aiAgents", {})
    )
    if agents and agents.get("nodes"):
        for a in agents["nodes"]:
            print(f"  Agent: {a['name']} (ID: {a['id']})")
    else:
        print("  No agents found (aiAgents may be null — Duo not enabled?)")
    return agents


def main():
    print("=" * 60)
    print("  Skyrchitect — GitLab Duo Agent Platform Setup")
    print("=" * 60)
    print()

    ready = check_prerequisites()

    if "--check" in sys.argv:
        list_agents()
        return

    if not ready:
        print("\nPlease activate the trial first, then re-run this script.")
        return

    if "--agent" in sys.argv or "--all" in sys.argv:
        create_agent()

    if "--flow" in sys.argv or "--all" in sys.argv:
        trigger_flow()

    if "--list" in sys.argv:
        list_agents()

    print("\n--- Done ---")
    print("Next steps:")
    print("  1. Go to Automate > Agents and enable the Skyrchitect agent")
    print("  2. Create a new issue using the Infrastructure Request template")
    print("  3. Mention or assign the flow service account on the issue")
    print("  4. Watch the flow generate Terraform and open a merge request")


if __name__ == "__main__":
    main()
