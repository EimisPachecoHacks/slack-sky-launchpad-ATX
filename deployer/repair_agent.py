"""Self-improving repair core: diagnose a failed deployment and author a skill.

When a cloud deployment FAILS this module hands the rich failure context (from
``log_collector``) to Google's **Gemini Interactions API**, which spins up an
**Antigravity** managed agent (model ``antigravity-preview-05-2026``). That
agent reasons / browses provider docs / executes code inside an ephemeral
hosted Linux environment, then returns:

  * corrected Terraform files, and
  * a NEW generalized SKILL.md capturing the lesson learned.

Statefulness: the Interactions API returns an ``env_id`` for the hosted
environment. We thread it back on retries so the agent keeps its memory across
attempts on the same deployment.

The Interactions / Antigravity surface is a PREVIEW API. The primary path is
written against its described interface but is fully wrapped: on ANY failure we
fall back to a DIRECT call to ``gemini-3.5-flash`` so the demo never hard-fails.

All third-party deps (``google-genai``, ``requests``) are imported LAZILY,
inside functions in try/except, with clear error messages. The orchestrator
consolidates requirements later.
"""

from __future__ import annotations

import json
import os
import re

# --- Model constants -------------------------------------------------------
# Antigravity managed agent (preview) driven via the Gemini Interactions API.
ANTIGRAVITY_MODEL = "antigravity-preview-05-2026"
# Direct-call fallback model (a Gemini 3.5 class model).
GEMINI_FALLBACK_MODEL = "gemini-3.5-flash"

# Base endpoints. The Interactions API is a preview surface; the shape assumed
# below is documented inline at ``_run_antigravity``.
_GENAI_BASE = "https://generativelanguage.googleapis.com/v1beta"
_INTERACTIONS_BASE = "https://generativelanguage.googleapis.com/v1alpha"

# Where this module's persona lives, declared as the agent's system identity.
_AGENTS_MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AGENTS.md")

# Network timeout (seconds) for any HTTP call.
_HTTP_TIMEOUT = 90


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def diagnose_and_author(
    failure_context: dict,
    tf_files: dict[str, str],
    existing_skills: dict[str, str] | None = None,
    env_id: str | None = None,
) -> dict:
    """Diagnose a failed Terraform deployment and author a reusable skill.

    Args:
        failure_context: From ``log_collector.collect_failure_context`` —
            ``{provider, terraform_errors, terraform_output_excerpt,
            cloud_logs, tf_snippets, summary, ...}``.
        tf_files: ``filename -> terraform content`` to be repaired.
        existing_skills: ``name -> SKILL.md`` content; the agent's starting
            toolkit, declared as its available skills.
        env_id: Pass the prior ``env_id`` to RESUME the agent's stateful memory
            across retries on the same deployment.

    Returns:
        ``{fixed_files, new_skill, env_id, changes, used_fallback}`` — see the
        module-level contract. ``new_skill`` always includes a ``markdown``
        SKILL.md body (synthesized from fields if the model omitted it).
    """
    existing_skills = existing_skills or {}
    tf_files = tf_files or {}

    prompt = _build_prompt(failure_context, tf_files, existing_skills)

    used_fallback = False
    new_env_id = env_id

    # --- Primary path: Antigravity managed agent --------------------------
    try:
        text, new_env_id = _run_antigravity(prompt, env_id, existing_skills)
    except Exception:
        # ANY failure (lib missing, endpoint unreachable, non-2xx, bad shape)
        # falls back to a direct Gemini call so the demo never hard-fails.
        used_fallback = True
        text = _run_gemini_fallback(prompt)
        # No hosted environment in fallback mode; keep/seed a synthetic id so
        # callers always have something to thread on the next retry.
        new_env_id = env_id or "fallback-no-env"

    parsed = _extract_json(text) or {}

    return _assemble_result(
        parsed=parsed,
        failure_context=failure_context,
        tf_files=tf_files,
        env_id=new_env_id,
        used_fallback=used_fallback,
    )


# ---------------------------------------------------------------------------
# Primary path: Antigravity via the Gemini Interactions API
# ---------------------------------------------------------------------------


def _run_antigravity(
    prompt: str,
    env_id: str | None,
    existing_skills: dict[str, str],
) -> tuple[str, str]:
    """Create or resume an Antigravity hosted agent session; return its reply.

    Returns ``(text_response, new_env_id)``.

    ASSUMED PREVIEW ENDPOINT SHAPE (Gemini Interactions API)
    --------------------------------------------------------
    The Interactions API creates a stateful, tool-using *interaction* backed by
    an ephemeral hosted Linux environment. We model it as::

        POST {INTERACTIONS_BASE}/interactions:run?key=API_KEY
        {
          "model": "antigravity-preview-05-2026",
          "environmentId": "<env_id or omitted to create new>",
          "agent": {
            "persona": "<AGENTS.md body>",
            "skills": [ {"name": "...", "content": "<SKILL.md>"} ]
          },
          "tools": ["code_execution", "web_browse"],
          "input": "<prompt>"
        }

    Response::

        {
          "environmentId": "<env id to resume with>",
          "output": {"text": "<agent final answer>"}
        }

    Since the exact preview surface may not be reachable, the actual HTTP is
    wrapped; ANY failure raises and the caller falls back. We try the
    ``google-genai`` SDK first (if it exposes an interactions client), then a
    raw REST call via ``requests``/``urllib``.
    """
    api_key = _require_api_key()
    persona = _load_persona()
    skills_payload = [
        {"name": name, "content": content}
        for name, content in (existing_skills or {}).items()
    ]

    # --- Attempt 1: google-genai SDK (if it surfaces interactions) --------
    sdk_text, sdk_env = _run_antigravity_sdk(
        prompt, env_id, persona, skills_payload, api_key
    )
    if sdk_text is not None:
        return sdk_text, sdk_env or env_id or "antigravity-env"

    # --- Attempt 2: raw REST against the Interactions endpoint ------------
    body: dict = {
        "model": ANTIGRAVITY_MODEL,
        "agent": {"persona": persona, "skills": skills_payload},
        "tools": ["code_execution", "web_browse"],
        "input": prompt,
    }
    if env_id:
        body["environmentId"] = env_id

    url = f"{_INTERACTIONS_BASE}/interactions:run?key={api_key}"
    data = _http_post_json(url, body)

    new_env = (
        data.get("environmentId")
        or data.get("env_id")
        or env_id
        or "antigravity-env"
    )
    text = _extract_interactions_text(data)
    if not text:
        raise RuntimeError("Antigravity response contained no text output")
    return text, new_env


def _run_antigravity_sdk(
    prompt: str,
    env_id: str | None,
    persona: str,
    skills_payload: list[dict],
    api_key: str,
) -> tuple[str | None, str | None]:
    """Try the ``google-genai`` SDK's interactions surface.

    Returns ``(text, env_id)`` on success, or ``(None, None)`` if the SDK is
    unavailable or does not expose an interactions client (so the REST path is
    used instead). Real call errors are allowed to propagate to the fallback.
    """
    try:
        from google import genai  # type: ignore
    except Exception:
        return None, None

    client = genai.Client(api_key=api_key)

    # The interactions surface is preview and may not exist on the installed
    # SDK version. If the attribute is missing, defer to the REST path.
    interactions = getattr(client, "interactions", None)
    if interactions is None or not hasattr(interactions, "run"):
        return None, None

    result = interactions.run(
        model=ANTIGRAVITY_MODEL,
        environment_id=env_id,
        agent={"persona": persona, "skills": skills_payload},
        tools=["code_execution", "web_browse"],
        input=prompt,
    )

    text = getattr(result, "text", None)
    if text is None and hasattr(result, "output"):
        text = getattr(result.output, "text", None)
    new_env = getattr(result, "environment_id", None) or env_id
    if not text:
        raise RuntimeError("Antigravity SDK returned no text")
    return text, new_env


def _extract_interactions_text(data: dict) -> str:
    """Pull the agent's final text out of an Interactions API response dict."""
    output = data.get("output")
    if isinstance(output, dict):
        if output.get("text"):
            return str(output["text"])
        # Some shapes nest parts like generateContent.
        parts = output.get("parts")
        if isinstance(parts, list):
            joined = "".join(
                p.get("text", "") for p in parts if isinstance(p, dict)
            )
            if joined:
                return joined
    if isinstance(output, str):
        return output
    # Last resort: a generateContent-style candidates array.
    return _extract_generatecontent_text(data)


# ---------------------------------------------------------------------------
# Fallback path: direct gemini-3.5-flash generateContent
# ---------------------------------------------------------------------------


def _run_gemini_fallback(prompt: str) -> str:
    """Direct call to ``gemini-3.5-flash`` ``generateContent``. Returns text.

    Prefers the ``google-genai`` SDK; falls back to REST. Raises with a clear
    message if neither the SDK nor ``requests``/``urllib`` can complete the
    call (this is the last line of defense, so failures here are real).
    """
    api_key = _require_api_key()

    # --- Attempt 1: google-genai SDK -------------------------------------
    try:
        from google import genai  # type: ignore

        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model=GEMINI_FALLBACK_MODEL,
            contents=prompt,
        )
        text = getattr(resp, "text", None)
        if text:
            return text
    except Exception:
        # Fall through to REST.
        pass

    # --- Attempt 2: REST generateContent ---------------------------------
    url = (
        f"{_GENAI_BASE}/models/{GEMINI_FALLBACK_MODEL}:generateContent"
        f"?key={api_key}"
    )
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    data = _http_post_json(url, body)
    text = _extract_generatecontent_text(data)
    if not text:
        raise RuntimeError("Gemini fallback returned no text output")
    return text


def _extract_generatecontent_text(data: dict) -> str:
    """Extract concatenated text from a generateContent response dict."""
    candidates = data.get("candidates") or []
    for cand in candidates:
        content = cand.get("content") if isinstance(cand, dict) else None
        if not isinstance(content, dict):
            continue
        parts = content.get("parts") or []
        joined = "".join(
            p.get("text", "") for p in parts if isinstance(p, dict)
        )
        if joined:
            return joined
    return ""


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------


def _build_prompt(
    failure_context: dict,
    tf_files: dict[str, str],
    existing_skills: dict[str, str],
) -> str:
    """Build the instruction prompt demanding STRICT JSON back from the agent."""
    fc = failure_context or {}
    provider = fc.get("provider", "unknown")

    skills_block = "\n".join(f"- {name}" for name in (existing_skills or {})) or (
        "- (none yet)"
    )

    files_block = "\n\n".join(
        f"### FILE: {fname}\n```hcl\n{content}\n```"
        for fname, content in tf_files.items()
    ) or "(no terraform files provided)"

    # Compact, model-friendly view of the failure context.
    context_block = json.dumps(
        {
            "provider": provider,
            "summary": fc.get("summary", ""),
            "terraform_errors": fc.get("terraform_errors", []),
            "terraform_output_excerpt": fc.get("terraform_output_excerpt", ""),
            "cloud_logs": fc.get("cloud_logs", []),
            "tf_snippets": fc.get("tf_snippets", {}),
        },
        indent=2,
        default=str,
    )

    file_keys = ", ".join(tf_files.keys()) or "(none)"

    return f"""\
You are the Sky Launchpad Repair Agent: an expert SRE and Terraform engineer.
A cloud deployment to {provider} just FAILED. Diagnose the root cause from the
failure context, then (1) correct the Terraform and (2) author ONE new,
GENERALIZED reusable skill that captures the lesson so future deployments avoid
this class of error.

You may browse provider documentation and execute code in your hosted
environment to verify your reasoning before answering.

## Your existing skills (toolkit)
{skills_block}

## Failure context (JSON)
{context_block}

## Current Terraform files
{files_block}

## Output requirements
Respond with STRICT JSON ONLY (optionally inside a ```json fence). Use EXACTLY
this schema. Do not add commentary outside the JSON.

{{
  "fixed_files": {{ "<filename>": "<full corrected terraform content>" }},
  "new_skill": {{
    "name": "<kebab-case-slug, e.g. gcp-enable-compute-api>",
    "description": "<one line>",
    "error_signature": "<short canonical signature for retrieval matching>",
    "root_cause": "<concise root cause>",
    "fix_pattern": "<how to prevent/fix this generally>",
    "markdown": "<FULL SKILL.md body WITH frontmatter, see format below>"
  }},
  "changes": ["<human-readable summary of each edit>"]
}}

Rules:
- "fixed_files" MUST use these same keys (edit in place): {file_keys}
- "new_skill.name" MUST be a kebab-case slug (lowercase, hyphens only).
- "markdown" MUST follow this exact SKILL.md format:

---
name: <kebab-slug>
description: >
  <one or two line description>
metadata:
  slash-command: enabled
  learned: true
  error_signature: "<signature>"
---

## <Human Title>

### Root Cause
...
### Fix Pattern
...
### Terraform Example
```hcl
...
```
"""


# ---------------------------------------------------------------------------
# JSON extraction (mirrors the project's response_parser style)
# ---------------------------------------------------------------------------


def _extract_json(text: str) -> dict | None:
    """Robustly extract a JSON object from a model response.

    Handles ```json fenced blocks, plain ``` fences, and raw brace spans.
    Returns the parsed dict, or None if nothing parses.
    """
    if not text:
        return None

    # 1) ```json ... ``` fence.
    match = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        parsed = _try_loads(match.group(1))
        if parsed is not None:
            return parsed

    # 2) Generic ``` ... ``` fence containing an object.
    match = re.search(r"```\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        parsed = _try_loads(match.group(1))
        if parsed is not None:
            return parsed

    # 3) Widest raw brace span (greedy: outermost object).
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        parsed = _try_loads(match.group(0))
        if parsed is not None:
            return parsed

    return None


def _try_loads(raw: str) -> dict | None:
    """``json.loads`` that returns None instead of raising on a dict result."""
    try:
        value = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return None
    return value if isinstance(value, dict) else None


# ---------------------------------------------------------------------------
# Result assembly / validation
# ---------------------------------------------------------------------------


def _assemble_result(
    parsed: dict,
    failure_context: dict,
    tf_files: dict[str, str],
    env_id: str,
    used_fallback: bool,
) -> dict:
    """Validate/default the parsed model output into the contract dict."""
    # fixed_files: keep only str->str; default to originals if missing.
    fixed_files: dict[str, str] = {}
    raw_fixed = parsed.get("fixed_files")
    if isinstance(raw_fixed, dict):
        for name, content in raw_fixed.items():
            if isinstance(name, str) and isinstance(content, str):
                fixed_files[name] = content
    if not fixed_files:
        fixed_files = dict(tf_files)

    changes = parsed.get("changes")
    if not isinstance(changes, list):
        changes = []
    changes = [str(c) for c in changes]

    new_skill = _build_new_skill(
        parsed.get("new_skill"), failure_context, changes
    )

    return {
        "fixed_files": fixed_files,
        "new_skill": new_skill,
        "env_id": env_id,
        "changes": changes,
        "used_fallback": used_fallback,
    }


def _build_new_skill(
    raw_skill,
    failure_context: dict,
    changes: list[str],
) -> dict:
    """Normalize the new_skill block; synthesize markdown if the model omitted it."""
    skill = raw_skill if isinstance(raw_skill, dict) else {}

    fc = failure_context or {}
    provider = fc.get("provider", "cloud")

    name = _slugify(skill.get("name") or f"{provider}-deployment-fix")
    description = str(
        skill.get("description")
        or f"Lesson learned from a failed {provider} Terraform deployment."
    ).strip()
    error_signature = str(
        skill.get("error_signature") or _derive_error_signature(fc)
    ).strip()
    root_cause = str(
        skill.get("root_cause") or fc.get("summary") or "Unknown root cause."
    ).strip()
    fix_pattern = str(
        skill.get("fix_pattern")
        or "Apply the corrected Terraform and re-run the deployment."
    ).strip()

    markdown = skill.get("markdown")
    if not isinstance(markdown, str) or not markdown.strip():
        markdown = _synthesize_markdown(
            name=name,
            description=description,
            error_signature=error_signature,
            root_cause=root_cause,
            fix_pattern=fix_pattern,
            changes=changes,
        )

    return {
        "name": name,
        "description": description,
        "error_signature": error_signature,
        "root_cause": root_cause,
        "fix_pattern": fix_pattern,
        "markdown": markdown,
    }


def _derive_error_signature(failure_context: dict) -> str:
    """Build a short canonical signature from the first terraform error."""
    errors = failure_context.get("terraform_errors") or []
    for err in errors:
        if isinstance(err, dict) and err.get("message"):
            msg = str(err["message"])
            # Trim noisy IDs/quotes to a stable-ish signature.
            msg = re.sub(r"['\"`].*?['\"`]", "X", msg)
            return msg.strip()[:120]
    summary = failure_context.get("summary")
    return (str(summary).splitlines()[0][:120]) if summary else "unknown-error"


def _synthesize_markdown(
    name: str,
    description: str,
    error_signature: str,
    root_cause: str,
    fix_pattern: str,
    changes: list[str],
) -> str:
    """Synthesize a SKILL.md body matching the project's skill format."""
    title = name.replace("-", " ").title()
    changes_block = "\n".join(f"- {c}" for c in changes) or "- (see fix pattern)"
    return f"""\
---
name: {name}
description: >
  {description}
metadata:
  slash-command: enabled
  learned: true
  error_signature: "{error_signature}"
---

## {title}

### Root Cause
{root_cause}

### Fix Pattern
{fix_pattern}

### Changes Applied
{changes_block}

### Terraform Example
```hcl
# Apply the corrected configuration produced by the repair agent and
# re-run `terraform plan` / `terraform apply`.
```
"""


def _slugify(value: str) -> str:
    """Coerce a string into a safe kebab-case slug."""
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "learned-skill"


# ---------------------------------------------------------------------------
# Small shared helpers
# ---------------------------------------------------------------------------


def _require_api_key() -> str:
    """Read ``GEMINI_API_KEY`` from the environment or raise a clear error."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set; cannot call the Gemini Interactions "
            "API or the gemini-3.5-flash fallback."
        )
    return api_key


def _load_persona() -> str:
    """Load the AGENTS.md persona that declares the repair agent's identity."""
    try:
        with open(_AGENTS_MD, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        # Persona file optional; degrade to a one-line identity.
        return "Sky Launchpad Repair Agent: an SRE/Terraform expert."


def _http_post_json(url: str, body: dict) -> dict:
    """POST JSON and return the parsed JSON response.

    Prefers ``requests``; falls back to stdlib ``urllib``. Raises on transport
    errors or non-JSON responses (callers handle the fallback).
    """
    payload = json.dumps(body).encode("utf-8")
    headers = {"Content-Type": "application/json"}

    # --- Attempt 1: requests ---------------------------------------------
    try:
        import requests  # type: ignore

        resp = requests.post(
            url, data=payload, headers=headers, timeout=_HTTP_TIMEOUT
        )
        resp.raise_for_status()
        return resp.json()
    except ImportError:
        pass  # requests not installed; use urllib below.

    # --- Attempt 2: stdlib urllib ----------------------------------------
    import urllib.request

    req = urllib.request.Request(
        url, data=payload, headers=headers, method="POST"
    )
    with urllib.request.urlopen(req, timeout=_HTTP_TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Smoke test (no network, no API key required)
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    # Canned agent reply: STRICT JSON with all required fields incl. markdown.
    _CANNED = """\
Here is the repair:
```json
{
  "fixed_files": {
    "main.tf": "resource \\"google_project_service\\" \\"compute\\" {\\n  service = \\"compute.googleapis.com\\"\\n}\\n"
  },
  "new_skill": {
    "name": "GCP Enable Compute API",
    "description": "Enable the Compute Engine API before creating compute resources.",
    "error_signature": "Compute Engine API has not been enabled on project X",
    "root_cause": "The compute.googleapis.com service was not enabled on the project.",
    "fix_pattern": "Add a google_project_service resource enabling compute.googleapis.com and depend on it.",
    "markdown": "---\\nname: gcp-enable-compute-api\\ndescription: >\\n  Enable Compute Engine API first.\\nmetadata:\\n  slash-command: enabled\\n  learned: true\\n  error_signature: \\"Compute Engine API has not been enabled\\"\\n---\\n\\n## GCP Enable Compute API\\n\\n### Root Cause\\nAPI not enabled.\\n\\n### Fix Pattern\\nEnable the service.\\n"
  },
  "changes": ["Added google_project_service to enable compute.googleapis.com"]
}
```
"""

    def _fake_antigravity(prompt, env_id, existing_skills):  # type: ignore
        return _CANNED, env_id or "env-smoke-123"

    def _fake_fallback(prompt):  # type: ignore
        return _CANNED

    # Monkeypatch the network entry points.
    _run_antigravity = _fake_antigravity  # noqa: F811
    _run_gemini_fallback = _fake_fallback  # noqa: F811
    globals()["_run_antigravity"] = _fake_antigravity
    globals()["_run_gemini_fallback"] = _fake_fallback

    failure = {
        "provider": "gcp",
        "summary": "Compute Engine API has not been enabled on project demo.",
        "terraform_errors": [
            {"message": "Compute Engine API has not been enabled on project 'demo'"}
        ],
        "terraform_output_excerpt": "Error: ...",
        "cloud_logs": [],
        "tf_snippets": {},
    }
    tf = {"main.tf": 'resource "google_compute_network" "vpc" {}\n'}

    # 1) Primary path (mocked antigravity).
    result = diagnose_and_author(failure, tf, existing_skills={"x": "..."})
    assert isinstance(result, dict), "result must be a dict"
    assert result["fixed_files"], "expected fixed_files"
    assert "main.tf" in result["fixed_files"], "fixed_files must keep keys"
    assert result["new_skill"]["markdown"].strip(), "new_skill.markdown required"
    assert result["new_skill"]["name"] == "gcp-enable-compute-api", "slug kept"
    assert result["env_id"] == "env-smoke-123", "env_id must thread through"
    assert result["used_fallback"] is False, "primary path should not fall back"
    assert result["changes"], "expected changes list"

    # 2) Resume with a prior env_id (stateful memory thread).
    result2 = diagnose_and_author(failure, tf, env_id="env-smoke-123")
    assert result2["env_id"] == "env-smoke-123", "resume must keep env_id"

    # 3) Fallback path: force antigravity to raise -> direct gemini fallback.
    def _boom(prompt, env_id, existing_skills):  # type: ignore
        raise RuntimeError("interactions endpoint unreachable")

    globals()["_run_antigravity"] = _boom
    result3 = diagnose_and_author(failure, tf, env_id="prev-env")
    assert result3["used_fallback"] is True, "should report fallback"
    assert result3["fixed_files"], "fallback still returns fixed_files"
    assert result3["new_skill"]["markdown"].strip(), "fallback markdown required"
    assert result3["env_id"] == "prev-env", "fallback keeps prior env_id"

    # 4) Markdown synthesis when the model omits it.
    synth = _build_new_skill(
        {"name": "Some Lesson", "root_cause": "rc", "fix_pattern": "fp"},
        failure,
        ["did a thing"],
    )
    assert synth["name"] == "some-lesson", "name must be slugified"
    assert "---" in synth["markdown"], "synthesized markdown needs frontmatter"

    print("PASS")
    print("-" * 60)
    print("env_id:", result["env_id"])
    print("used_fallback (primary / fallback):", result["used_fallback"], "/", result3["used_fallback"])
    print("fixed_files keys:", list(result["fixed_files"].keys()))
    print("new_skill.name:", result["new_skill"]["name"])
    print("changes:", result["changes"])
