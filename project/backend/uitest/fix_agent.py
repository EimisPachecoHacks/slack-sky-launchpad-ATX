"""Autonomous UI fix agent for "Sky Launchpad" (Phase 2 of the self-healing loop).

Given a bug captured by the Playwright UI test runner, this module:

1. Investigates: heuristically picks a handful of likely-relevant frontend
   source files (keyword overlap with the error/workflow), reads them.
2. Asks Gemma 4 to produce a structured fix as STRICT JSON
   (root_cause, solution, files, mr_title, mr_body).
3. Optionally writes the proposed files to disk (guarded against path escapes).
4. Optionally opens a GitLab merge request with the changed files.

Design notes:
- ``diagnose_and_fix`` never raises. On any failure it returns a dict with an
  ``error`` field plus whatever was gathered so far.
- The model call goes through ``backend.llm_client``, so it runs on whichever
  backend serves (Gemma 4 on the AMD GPU).
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MAX_FILES_TO_READ = 4
MAX_FILE_BYTES = 6 * 1024  # ~6KB per file injected into the prompt
SOURCE_EXTENSIONS = (".tsx", ".ts", ".jsx", ".js")
# Directories we never want to walk into.
SKIP_DIRS = {"node_modules", "dist", "build", ".git", "__pycache__", "coverage"}

# Records which inference backend produced the answer (always "amd").
# Exposed so callers/tests can introspect which path ran.
LAST_BACKEND_USED: str = "none"


# ---------------------------------------------------------------------------
# File investigation (lightweight keyword-overlap heuristic)
# ---------------------------------------------------------------------------

_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_]{2,}")
# Generic words that carry no signal for locating a component/file.
_STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "from", "into", "your",
    "error", "errors", "failed", "failure", "console", "click", "button",
    "page", "test", "workflow", "step", "could", "should", "would", "when",
    "while", "after", "before", "have", "has", "was", "were", "are", "not",
    "but", "you", "all", "any", "can", "cannot", "unable", "expected",
    "actual", "element", "found", "visible", "screen", "url", "http",
    "https", "localhost", "true", "false", "null", "undefined", "value",
}


def _keywords(text: str) -> List[str]:
    """Extract scoring keywords from free text (lowercased, deduped)."""
    out: List[str] = []
    seen: set[str] = set()
    for m in _WORD_RE.finditer(text or ""):
        w = m.group(0).lower()
        if w in _STOPWORDS or w in seen:
            continue
        seen.add(w)
        out.append(w)
    return out


def _bug_text(bug: Dict[str, Any]) -> str:
    """Concatenate the human-readable fields of a bug for keyword extraction."""
    parts: List[str] = []
    for key in ("workflow", "error", "signal", "summary", "target_url"):
        val = bug.get(key)
        if isinstance(val, str) and val:
            parts.append(val)
    console = bug.get("console_errors")
    if isinstance(console, list):
        for c in console:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict):
                parts.append(json.dumps(c))
    return "\n".join(parts)


def _score_file(path: str, content: str, keywords: List[str]) -> int:
    """Score a candidate file by keyword overlap.

    Matches in the file path (e.g. component name) are weighted heavily; matches
    in the file body count once each regardless of repetition.
    """
    if not keywords:
        return 0
    path_l = path.lower()
    body_l = content.lower()
    score = 0
    for kw in keywords:
        if kw in path_l:
            score += 5
        if kw in body_l:
            score += 1
    return score


def _investigate(
    frontend_dir_abs: str, repo_root: str, keywords: List[str]
) -> List[Dict[str, str]]:
    """Walk the frontend dir, score source files, return the top matches.

    Returns a list of {"path" (repo-relative), "abs_path", "content"} dicts,
    each content capped to ``MAX_FILE_BYTES``.
    """
    candidates: List[Tuple[int, str, str]] = []  # (score, abs_path, content)

    if not os.path.isdir(frontend_dir_abs):
        logger.warning("fix_agent: frontend dir not found: %s", frontend_dir_abs)
        return []

    for root, dirs, files in os.walk(frontend_dir_abs):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            if not fname.endswith(SOURCE_EXTENSIONS):
                continue
            # Skip test/spec files unless the bug clearly references tests.
            lower = fname.lower()
            if (".test." in lower or ".spec." in lower) and "test" not in keywords:
                continue
            abs_path = os.path.join(root, fname)
            try:
                with open(abs_path, "r", encoding="utf-8", errors="replace") as fh:
                    content = fh.read()
            except OSError:
                continue
            score = _score_file(abs_path, content, keywords)
            candidates.append((score, abs_path, content))

    # Highest score first; on ties prefer shorter files (likely more focused).
    candidates.sort(key=lambda t: (-t[0], len(t[2])))

    selected: List[Dict[str, str]] = []
    for score, abs_path, content in candidates[:MAX_FILES_TO_READ]:
        if score <= 0 and selected:
            # Don't pad with zero-signal files once we have at least one hit.
            break
        rel = os.path.relpath(abs_path, repo_root)
        selected.append(
            {
                "path": rel.replace(os.sep, "/"),
                "abs_path": abs_path,
                "content": content[:MAX_FILE_BYTES],
            }
        )
    return selected


# ---------------------------------------------------------------------------
# Prompt construction + JSON extraction
# ---------------------------------------------------------------------------

_SYSTEM_INSTRUCTION = """\
You are an autonomous frontend engineering agent for the "Sky Launchpad" React
app. A UI test run found a UI bug. You are given the bug report
and the contents of the most likely-relevant frontend source files.

Your job: identify the root cause and produce a minimal, correct fix.

Rules:
- Prefer a root-cause fix over a superficial patch.
- Only change files you were shown, unless a new file is clearly required.
- For each file you change, return its COMPLETE new content (not a diff).
- Keep naming/style consistent with the existing code.
- Be concrete and specific to this codebase; no generic placeholders.

Respond with STRICT JSON ONLY (no prose, no markdown fences) matching:
{
  "root_cause": "<1-3 sentences: where and why>",
  "solution": "<1-3 sentences: what the fix does>",
  "files": [
    {"path": "<repo-relative path, e.g. project/src/...>", "new_content": "<full file content>"}
  ],
  "mr_title": "<concise fix-focused title>",
  "mr_body": "<markdown using the EXACT structure below>"
}

The mr_body MUST use this exact section structure:
## Summary
<1-3 sentences describing the user-visible bug and the fix impact>

## Root Cause
- <where the bug was found>
- <why it happened>

## Changes Made
- `<file-path>`: <what changed and why>

## Validation
- <checks performed, or clearly state what could not be validated>
"""


def _build_user_prompt(bug: Dict[str, Any], files: List[Dict[str, str]]) -> str:
    bug_json = json.dumps(bug, indent=2, ensure_ascii=False)
    if files:
        file_blocks = []
        for f in files:
            file_blocks.append(
                f"=== FILE: {f['path']} ===\n{f['content']}\n=== END FILE ==="
            )
        files_section = "\n\n".join(file_blocks)
    else:
        files_section = (
            "(No candidate source files were located by keyword search. "
            "Infer the fix from the bug report and propose file paths under "
            "project/src/.)"
        )

    return (
        "BUG REPORT (raw JSON):\n"
        f"{bug_json}\n\n"
        "CANDIDATE FRONTEND SOURCE FILES (truncated):\n"
        f"{files_section}\n\n"
        "Diagnose the root cause and return the STRICT JSON fix object now."
    )


def _extract_json(text: str) -> Dict[str, Any]:
    """Best-effort extraction of a JSON object from a model response.

    Handles ```json fences and surrounding prose by locating the outermost
    balanced { ... } block.
    """
    if not text:
        raise ValueError("empty model response")

    # Strip code fences if present.
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    candidate = fence.group(1).strip() if fence else text.strip()

    # Fast path.
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    # Locate the first balanced { ... } object.
    start = candidate.find("{")
    if start == -1:
        raise ValueError("no JSON object found in model response")
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(candidate)):
        ch = candidate[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(candidate[start : i + 1])
    raise ValueError("unbalanced JSON object in model response")


# ---------------------------------------------------------------------------
# Model call: Gemma 4 via the unified OpenAI-compatible client
# ---------------------------------------------------------------------------


async def _reason_about_fix(
    system_instruction: str, user_prompt: str
) -> Tuple[str, str]:
    """Run the model. Returns (raw_text, backend_used)."""
    global LAST_BACKEND_USED

    from backend.llm_client import chat, _provider

    text = chat(
        user_prompt,
        system=system_instruction,
        temperature=0.2,
        max_tokens=4096,
        kind="ui-fix",
    )
    if not text.strip():
        raise RuntimeError("empty response from the fix model")

    LAST_BACKEND_USED = _provider()
    return text, LAST_BACKEND_USED


# ---------------------------------------------------------------------------
# Disk writes (path-escape guarded)
# ---------------------------------------------------------------------------


def _safe_join(repo_root: str, rel_path: str) -> Optional[str]:
    """Resolve rel_path under repo_root, returning None if it escapes the root."""
    repo_root_abs = os.path.realpath(repo_root)
    candidate = os.path.realpath(os.path.join(repo_root_abs, rel_path))
    if candidate == repo_root_abs:
        return None
    if not candidate.startswith(repo_root_abs + os.sep):
        return None
    return candidate


def _write_files(
    repo_root: str, files: List[Dict[str, Any]]
) -> Tuple[List[str], List[str]]:
    """Write each file's new_content to disk. Returns (written_rel, errors)."""
    written: List[str] = []
    errors: List[str] = []
    for f in files:
        rel = (f.get("path") or "").strip()
        new_content = f.get("new_content")
        if not rel or new_content is None:
            errors.append(f"skipped file with missing path/content: {f.get('path')!r}")
            continue
        abs_path = _safe_join(repo_root, rel)
        if abs_path is None:
            errors.append(f"refused path escape: {rel}")
            continue
        try:
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w", encoding="utf-8") as fh:
                fh.write(new_content)
            written.append(rel.replace(os.sep, "/"))
        except OSError as e:
            errors.append(f"write failed for {rel}: {e}")
    return written, errors


# ---------------------------------------------------------------------------
# GitLab MR
# ---------------------------------------------------------------------------


def _slugify(text: str, max_len: int = 32) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-")
    if not slug:
        slug = uuid.uuid4().hex[:8]
    return slug[:max_len].strip("-")


def _open_merge_request(
    files: List[Dict[str, Any]], mr_title: str, mr_body: str, slug_source: str
) -> Dict[str, Any]:
    """Create a branch, commit changed files, and open an MR on GitLab.

    Returns {"mr_url", "branch", "note"} (note set on partial failure).
    """
    result: Dict[str, Any] = {"mr_url": "", "branch": "", "note": ""}

    token = os.getenv("GITLAB_TOKEN")
    project_path = os.getenv("GITLAB_PROJECT") or os.getenv("GITLAB_PROJECT_PATH")
    if not token or not project_path:
        result["note"] = "dry-run: GitLab not configured"
        return result

    try:
        from backend.gitlab_client import GitLabClient
    except Exception as e:  # noqa: BLE001
        result["note"] = f"GitLab client import failed: {e}"
        return result

    target_branch = os.getenv("GITLAB_TARGET_BRANCH", "main")
    branch = f"fix/ui-{_slugify(slug_source)}-{uuid.uuid4().hex[:6]}"
    result["branch"] = branch

    try:
        client = GitLabClient(token=token, project_path=project_path)

        # Note: we do NOT pre-create the branch — create_commit with start_branch
        # creates it atomically. Pre-creating + passing start_branch makes GitLab
        # reject the commit ("branch already exists").

        actions = []
        for f in files:
            rel = (f.get("path") or "").strip()
            content = f.get("new_content")
            if not rel or content is None:
                continue
            file_path = rel.replace(os.sep, "/")
            action = "update" if client.file_exists(file_path, ref=target_branch) else "create"
            actions.append(
                {"action": action, "file_path": file_path, "content": content}
            )

        if not actions:
            result["note"] = "no valid file actions to commit"
            return result

        commit_resp = client.create_commit(
            branch=branch,
            message=mr_title or "fix(ui): automated self-healing fix",
            actions=actions,
            start_branch=target_branch,
        )
        if isinstance(commit_resp, dict) and commit_resp.get("error"):
            result["note"] = f"commit failed: {commit_resp.get('detail') or commit_resp['error']}"
            return result

        mr_resp = client.create_merge_request(
            source_branch=branch,
            title=mr_title or "fix(ui): automated self-healing fix",
            description=mr_body or "",
            target_branch=target_branch,
            labels=os.getenv("FIX_AGENT_MR_LABELS", "ui,self-healing,automated"),
        )
        if isinstance(mr_resp, dict) and mr_resp.get("error"):
            result["note"] = f"MR create failed: {mr_resp.get('detail') or mr_resp['error']}"
            return result

        result["mr_url"] = mr_resp.get("web_url", "") if isinstance(mr_resp, dict) else ""
        if not result["mr_url"]:
            result["note"] = "MR created but no web_url returned"
    except Exception as e:  # noqa: BLE001
        result["note"] = f"GitLab MR step error: {e}"

    return result


# ---------------------------------------------------------------------------
# Public entrypoint
# ---------------------------------------------------------------------------


async def diagnose_and_fix(
    bug: Dict[str, Any],
    *,
    repo_root: str,
    frontend_dir: str = "project/src",
    apply: bool = False,
) -> Dict[str, Any]:
    """Diagnose a UI bug, propose a fix, optionally apply it and open a GitLab MR.

    See module docstring for behavior. Never raises: returns a dict, with an
    ``error`` field on failure.
    """
    out: Dict[str, Any] = {
        "root_cause": "",
        "solution": "",
        "files_changed": [],
        "mr_url": "",
        "branch": "",
        "mr_title": "",
        "applied": False,
        "note": "",
    }

    try:
        if not isinstance(bug, dict):
            out["error"] = "bug must be a dict"
            return out

        repo_root_abs = os.path.realpath(repo_root)
        frontend_abs = (
            frontend_dir
            if os.path.isabs(frontend_dir)
            else os.path.join(repo_root_abs, frontend_dir)
        )

        # 1. Investigate.
        keywords = _keywords(_bug_text(bug))
        candidate_files = _investigate(frontend_abs, repo_root_abs, keywords)
        out["investigated_files"] = [f["path"] for f in candidate_files]

        # 2. Reason about the fix.
        user_prompt = _build_user_prompt(bug, candidate_files)
        try:
            raw_text, backend = await _reason_about_fix(_SYSTEM_INSTRUCTION, user_prompt)
            out["backend"] = backend
        except Exception as e:  # noqa: BLE001
            out["error"] = f"model reasoning failed: {e}"
            return out

        try:
            fix = _extract_json(raw_text)
        except Exception as e:  # noqa: BLE001
            out["error"] = f"could not parse model JSON: {e}"
            out["raw_response"] = raw_text[:2000]
            return out

        out["root_cause"] = fix.get("root_cause", "") or ""
        out["solution"] = fix.get("solution", "") or ""
        out["mr_title"] = fix.get("mr_title", "") or ""
        mr_body = fix.get("mr_body", "") or ""

        files = fix.get("files")
        if not isinstance(files, list):
            files = []
        # Normalize entries.
        clean_files: List[Dict[str, Any]] = []
        for f in files:
            if isinstance(f, dict) and f.get("path") and f.get("new_content") is not None:
                clean_files.append({"path": f["path"], "new_content": f["new_content"]})

        if not clean_files:
            out["note"] = "model returned no usable file changes"
            return out

        # 3. Apply to disk (guarded).
        if apply:
            written, write_errors = _write_files(repo_root_abs, clean_files)
            out["files_changed"] = written
            out["applied"] = bool(written)
            if write_errors:
                out["note"] = "; ".join(write_errors)
            # Only push files that were actually written.
            mr_files = [f for f in clean_files if f["path"].replace(os.sep, "/") in written]
        else:
            out["files_changed"] = [f["path"] for f in clean_files]
            mr_files = clean_files

        # 4. GitLab MR (best-effort).
        slug_source = bug.get("workflow") or out["mr_title"] or "fix"
        mr_info = _open_merge_request(mr_files, out["mr_title"], mr_body, slug_source)
        out["mr_url"] = mr_info.get("mr_url", "")
        out["branch"] = mr_info.get("branch", "")
        mr_note = mr_info.get("note", "")
        if mr_note:
            out["note"] = (out["note"] + "; " + mr_note).strip("; ") if out["note"] else mr_note

        return out
    except Exception as e:  # noqa: BLE001 — contract: never raise.
        logger.exception("fix_agent.diagnose_and_fix unexpected failure")
        out["error"] = f"unexpected failure: {e}"
        return out
