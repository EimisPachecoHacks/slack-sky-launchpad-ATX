"""Self-improving repair core: diagnose a failed deployment and author a skill.

When a cloud deployment FAILS this module hands the rich failure context (from
``log_collector``) to **Gemma 4** on the AMD MI300X (see ``backend/llm_client.py``).
The model
returns:

  * corrected Terraform files, and
  * a NEW generalized SKILL.md capturing the lesson learned.

``env_id`` is threaded through on retries so callers can correlate attempts on
the same deployment. It no longer refers to a hosted environment: repair is a
single-shot LLM call against an open model, not a managed agent with its own
sandbox. We trade agentic doc-browsing and code execution for a fully open
stack that runs on our own AMD silicon.
"""

from __future__ import annotations

import json
import os
import re

# Repair runs on the same open model that generates architectures.
REPAIR_KIND = "repair"

# Where this module's persona lives, declared as the agent's system identity.
_AGENTS_MD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "AGENTS.md")


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
        env_id: Prior ``env_id``, threaded back so callers can correlate
            retries on the same deployment.

    Returns:
        ``{fixed_files, new_skill, env_id, changes, used_fallback}`` — see the
        module-level contract. ``new_skill`` always includes a ``markdown``
        SKILL.md body (synthesized from fields if the model omitted it).
    """
    existing_skills = existing_skills or {}
    tf_files = tf_files or {}

    prompt = _build_prompt(failure_context, tf_files, existing_skills)
    text = _run_llm(prompt)
    parsed = _extract_json(text) or {}

    return _assemble_result(
        parsed=parsed,
        failure_context=failure_context,
        tf_files=tf_files,
        env_id=env_id or "single-shot",
        used_fallback=False,
    )


# ---------------------------------------------------------------------------
# Repair path: Gemma 4 on the AMD GPU
# ---------------------------------------------------------------------------


def _run_llm(prompt: str) -> str:
    """Send the repair prompt to Gemma 4 and return the raw reply text.

    Imported lazily so the deployer stays usable as a standalone CLI (matching
    how ``deployer/main.py`` reaches into ``backend``).
    """
    try:
        from backend.llm_client import chat
    except Exception as exc:  # pragma: no cover - import-topology guard
        raise RuntimeError(
            "backend.llm_client is not importable; cannot run the repair agent."
        ) from exc

    return chat(
        prompt,
        system=_load_persona(),
        temperature=0.1,
        max_tokens=8192,
        kind=REPAIR_KIND,
    )


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

Reason from the failure context alone. You have no tools, no network access, and
no shell — do not claim to have run or verified anything.

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


def _load_persona() -> str:
    """Load the AGENTS.md persona that declares the repair agent's identity."""
    try:
        with open(_AGENTS_MD, "r", encoding="utf-8") as fh:
            return fh.read()
    except OSError:
        # Persona file optional; degrade to a one-line identity.
        return "Sky Launchpad Repair Agent: an SRE/Terraform expert."


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

    def _fake_llm(prompt):  # type: ignore
        return _CANNED

    # Monkeypatch the single network entry point.
    globals()["_run_llm"] = _fake_llm

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

    # 1) Happy path: strict JSON parsed, skill authored.
    result = diagnose_and_author(failure, tf, existing_skills={"x": "..."})
    assert isinstance(result, dict), "result must be a dict"
    assert result["fixed_files"], "expected fixed_files"
    assert "main.tf" in result["fixed_files"], "fixed_files must keep keys"
    assert result["new_skill"]["markdown"].strip(), "new_skill.markdown required"
    assert result["new_skill"]["name"] == "gcp-enable-compute-api", "slug kept"
    assert result["env_id"] == "single-shot", "absent env_id gets a synthetic id"
    assert result["used_fallback"] is False, "there is only one path now"
    assert result["changes"], "expected changes list"

    # 2) A caller-supplied env_id threads through for retry correlation.
    result2 = diagnose_and_author(failure, tf, env_id="prev-env")
    assert result2["env_id"] == "prev-env", "env_id must thread through"

    # 3) Unparseable model output still yields a synthesized skill, not a crash.
    globals()["_run_llm"] = lambda prompt: "I could not produce JSON, sorry."
    result3 = diagnose_and_author(failure, tf)
    assert result3["new_skill"]["markdown"].strip(), "markdown synthesized on bad JSON"
    assert result3["new_skill"]["error_signature"], "signature derived from context"

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
