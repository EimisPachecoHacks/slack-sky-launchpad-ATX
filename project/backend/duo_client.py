"""
GitLab Duo Agent Platform — Client

Routes AI requests through the GitLab Duo Agent Platform using two strategies:

1. **Primary: GraphQL Chat API** (`aiAction` mutation + `aiMessages` query)
   - Uses Duo Chat credits (included with Ultimate trial)
   - Reliable, REST-based, no subprocess dependency

2. **Fallback: CLI** (`glab duo cli run --goal`)
   - Uses Duo Workflow credits (limited, can be exhausted)
   - Kept as fallback in case GraphQL is unavailable

Both approaches ensure the hackathon requirement of using GitLab Duo is met.
"""

import json
import logging
import os
import subprocess
import tempfile
import time
from typing import Optional

import requests as _requests

logger = logging.getLogger(__name__)

_GLAB_PATH = os.getenv("GLAB_PATH", "/opt/homebrew/bin/glab")
_GITLAB_TOKEN = os.getenv("GITLAB_TOKEN", "")
_GITLAB_BASE_URL = os.getenv("GITLAB_BASE_URL", "https://gitlab.com")
_GITLAB_USER_ID = os.getenv("GITLAB_USER_ID", "")
_REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

_GRAPHQL_POLL_INTERVAL = 2
_GRAPHQL_MAX_POLLS = 60


class DuoCliClient:
    """Sends prompts to GitLab Duo via GraphQL Chat API (primary) or CLI (fallback)."""

    def __init__(
        self,
        token: Optional[str] = None,
        cwd: Optional[str] = None,
        timeout: int = 300,
    ):
        self.token = token or _GITLAB_TOKEN
        self.cwd = cwd or _REPO_ROOT
        self.timeout = timeout
        self.graphql_url = f"{_GITLAB_BASE_URL}/api/graphql"
        self.user_gid = ""
        self._resolve_user_gid()

    def _resolve_user_gid(self):
        """Resolve the current user's global ID for GraphQL mutations."""
        if _GITLAB_USER_ID:
            self.user_gid = f"gid://gitlab/User/{_GITLAB_USER_ID}"
            return
        try:
            data = self._rest_get(f"{_GITLAB_BASE_URL}/api/v4/user")
            uid = data.get("id")
            if uid:
                self.user_gid = f"gid://gitlab/User/{uid}"
                logger.info(f"[DuoClient] Resolved user GID: {self.user_gid}")
        except Exception as e:
            logger.warning(f"[DuoClient] Could not resolve user GID: {e}")

    def _rest_get(self, url: str) -> dict:
        resp = _requests.get(url, headers={
            "PRIVATE-TOKEN": self.token,
        }, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def _graphql(self, query: str, variables: Optional[dict] = None) -> dict:
        body: dict = {"query": query}
        if variables:
            body["variables"] = variables
        resp = _requests.post(self.graphql_url, json=body, headers={
            "PRIVATE-TOKEN": self.token,
        }, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def ask(self, goal: str, context_items: Optional[list] = None) -> str:
        """
        Send a prompt to GitLab Duo and return the assistant's text response.
        Tries GraphQL Chat API first, falls back to CLI if unavailable.
        """
        if self.user_gid:
            try:
                return self._ask_graphql(goal)
            except Exception as e:
                logger.warning(f"[DuoClient] GraphQL Chat failed: {e}, falling back to CLI")

        return self._ask_cli(goal)

    def _ask_graphql(self, goal: str) -> str:
        """Send prompt via GitLab Duo Chat GraphQL API."""
        start = time.time()
        logger.info(f"[DuoClient] Sending to Duo Chat GraphQL API ({len(goal)} chars)")

        escaped_goal = goal.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

        mutation = f'''mutation {{
            aiAction(input: {{
                chat: {{
                    content: "{escaped_goal}"
                    resourceId: "{self.user_gid}"
                }}
            }}) {{
                requestId
                errors
            }}
        }}'''

        result = self._graphql(mutation)
        ai_action = result.get("data", {}).get("aiAction", {})
        errors = ai_action.get("errors", [])
        request_id = ai_action.get("requestId")

        if errors:
            raise RuntimeError(f"Duo Chat mutation errors: {errors}")
        if not request_id:
            raise RuntimeError(f"No requestId returned: {result}")

        logger.info(f"[DuoClient] Chat request submitted: {request_id}")

        response_text = self._poll_for_response(request_id)
        elapsed = time.time() - start
        logger.info(f"[DuoClient] Duo Chat responded in {elapsed:.1f}s ({len(response_text)} chars)")
        logger.info(f"[DuoClient] Response preview: {response_text[:300]}...")
        return response_text

    def _poll_for_response(self, request_id: str) -> str:
        """Poll aiMessages until the assistant response is available."""
        query = f'''{{
            aiMessages(requestIds: ["{request_id}"]) {{
                nodes {{
                    requestId
                    role
                    content
                    errors
                }}
            }}
        }}'''

        for attempt in range(1, _GRAPHQL_MAX_POLLS + 1):
            time.sleep(_GRAPHQL_POLL_INTERVAL)
            result = self._graphql(query)
            nodes = result.get("data", {}).get("aiMessages", {}).get("nodes", [])

            for node in nodes:
                if node.get("role") == "ASSISTANT" and node.get("content"):
                    return node["content"]
                if node.get("errors"):
                    raise RuntimeError(f"Duo Chat error: {node['errors']}")

            if attempt % 5 == 0:
                logger.info(f"[DuoClient] Polling attempt {attempt}/{_GRAPHQL_MAX_POLLS}...")

        raise RuntimeError(f"Duo Chat timed out after {_GRAPHQL_MAX_POLLS * _GRAPHQL_POLL_INTERVAL}s")

    # ── CLI fallback ─────────────────────────────────────────────────

    def _ask_cli(self, goal: str) -> str:
        """Fallback: send prompt via glab duo cli run --goal."""
        start = time.time()
        logger.info(f"[DuoClient] Sending to GitLab Duo CLI (timeout={self.timeout}s)")
        logger.info(f"[DuoClient] Goal length: {len(goal)} chars")

        goal_file = None
        out_file = None
        try:
            goal_file = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, prefix="duo-goal-"
            )
            goal_file.write(goal)
            goal_file.close()

            out_file = tempfile.NamedTemporaryFile(
                mode="w", suffix=".txt", delete=False, prefix="duo-out-"
            )
            out_file.close()

            cmd_str = (
                f'echo "Y" | {_GLAB_PATH} duo cli '
                f'--gitlab-auth-token "$GITLAB_TOKEN" '
                f'run --goal "$(cat {goal_file.name})" '
                f'>{out_file.name} 2>&1'
            )

            env = os.environ.copy()
            env["GITLAB_TOKEN"] = self.token

            proc = subprocess.run(
                ["bash", "-c", cmd_str],
                cwd=self.cwd,
                timeout=self.timeout,
                env=env,
                capture_output=True,
            )

            elapsed = time.time() - start
            logger.info(f"[DuoClient] CLI exited code={proc.returncode} in {elapsed:.1f}s")

            with open(out_file.name, "r", errors="replace") as f:
                raw = f.read()

            logger.info(f"[DuoClient] Raw output: {len(raw)} chars")

            if proc.returncode != 0:
                error_snippet = self._extract_error(raw)
                if error_snippet:
                    logger.error(f"[DuoClient] ❌ CLI ERROR: {error_snippet}")
                if not raw:
                    stderr_snippet = (proc.stderr or b"").decode("utf-8", errors="replace")[:500] if isinstance(proc.stderr, bytes) else (proc.stderr or "")[:500]
                    logger.error(f"[DuoClient] No output, stderr: {stderr_snippet}")
                    raise RuntimeError(f"glab duo cli failed (code {proc.returncode}): {error_snippet or stderr_snippet}")

            response_text = self._extract_cli_response(raw)
            logger.info(f"[DuoClient] Response length: {len(response_text)} chars")
            logger.info(f"[DuoClient] Response preview: {response_text[:300]}...")
            return response_text

        except subprocess.TimeoutExpired:
            elapsed = time.time() - start
            logger.error(f"[DuoClient] Timed out after {elapsed:.1f}s")
            raise RuntimeError(f"GitLab Duo CLI timed out after {self.timeout}s")
        finally:
            for fpath in [
                goal_file.name if goal_file else None,
                out_file.name if out_file else None,
            ]:
                if fpath and os.path.exists(fpath):
                    os.unlink(fpath)

    def _extract_error(self, raw_output: str) -> str:
        """Pull the most relevant [error] line from CLI output."""
        for line in raw_output.split("\n"):
            if "[error]:" in line and any(kw in line.lower() for kw in [
                "403", "401", "credit", "forbidden", "unauthorized",
                "failed to create", "failed to initialize",
                "rate limit", "quota",
            ]):
                return line.split("[error]:")[-1].strip()[:300]
        for line in raw_output.split("\n"):
            if "[error]:" in line:
                return line.split("[error]:")[-1].strip()[:300]
        return ""

    def _extract_cli_response(self, raw_output: str) -> str:
        """Extract the assistant message content from Duo CLI debug output."""
        decoder = json.JSONDecoder()
        response_parts = []
        search_from = 0

        while True:
            idx = raw_output.find("[RunController]", search_from)
            if idx == -1:
                break
            brace_idx = raw_output.find("{", idx)
            if brace_idx == -1:
                break
            try:
                obj, end_pos = decoder.raw_decode(raw_output, brace_idx)
                if isinstance(obj, dict) and obj.get("role") == "assistant":
                    content = obj.get("content", "")
                    if content:
                        response_parts.append(content)
                search_from = end_pos
            except json.JSONDecodeError:
                search_from = brace_idx + 1

        if response_parts:
            return "\n".join(response_parts)

        logger.warning("[DuoClient] No assistant content found in CLI output, using fallback")
        return self._fallback_extract(raw_output)

    def _fallback_extract(self, raw_output: str) -> str:
        """Last-resort extraction: strip debug lines."""
        lines = raw_output.split("\n")
        clean = []
        for line in lines:
            s = line.strip()
            if not s:
                continue
            if any(skip in s for skip in [
                "[debug]:", "[info]:", "[warning]:", "[error]:",
                "Run the GitLab", "Always run without",
                "Shutting down", "good bye", "cliVersion",
                "[PersistentStorage]", "[SandboxConfig]",
                "[CredentialProvider]", "[WebSocket",
                "[DuoWorkflow", "[MCP", "[SystemContext",
                "[RunController]", "[RipgrepService]",
                "[CoreInstance", "[UserService]",
                "[BetaFeatures", "[AgentsMdResolver]",
                "[UserRuleContext", "[ShellContext",
                "[ModelResolver", "[GitLabBackend]",
                "[CliInitialization", "[CliApiService]",
                "[SlashCommand", "[GitleaksRule",
                "[SecretRedactor", "[WorkflowToken",
                "[ExecutorManager", "[CliExitHandler]",
                '"cliVersion":', '"arch":', '"nodeVersion":',
                '"osPlatform":', "fetch:", "configs_loaded",
            ]):
                continue
            clean.append(s)
        return "\n".join(clean)


_duo_client: Optional[DuoCliClient] = None


def get_duo_client() -> DuoCliClient:
    """Get or create a singleton DuoCliClient."""
    global _duo_client
    if _duo_client is None:
        _duo_client = DuoCliClient()
    return _duo_client
