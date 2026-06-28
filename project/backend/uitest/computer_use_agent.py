"""
Gemini Computer-Use vision-action agent for "Sky Launchpad" UI self-testing.

This module drives a live UI to accomplish a natural-language QA workflow using
the Google google-genai Computer Use tool (browser environment). It is fully
decoupled from any transport (no WebSocket here): the caller supplies async
callbacks for taking screenshots, executing actions, and emitting UI events.

Adapted from a working Benji Computer-Use loop. The turn structure mirrors the
reference: build Content with a text part + screenshot bytes part, call
client.models.generate_content with the Computer Use config, read
response.candidates[0].content.parts for function_calls, execute them, and feed
results back as types.FunctionResponse (with url) plus the new screenshot for the
next turn.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Any, Awaitable, Callable, Optional

# Model id: env override, default to the Computer Use preview model.
COMPUTER_USE_MODEL_ID = os.getenv(
    "COMPUTER_USE_MODEL_ID", "gemini-2.5-computer-use-preview-10-2025"
)

# Marker the model must emit on its final turn so we can parse a verdict.
WORKFLOW_RESULT_PREFIX = "WORKFLOW_RESULT:"

# A few sample QA workflows for the Sky Launchpad app.
SAMPLE_WORKFLOWS: list[dict] = [
    {
        "name": "Smoke: app loads",
        "prompt": (
            "Open the app and confirm the main page renders with visible "
            "navigation and no error screen."
        ),
    },
    {
        "name": "Deploy page",
        "prompt": (
            "Navigate to the Deploy page and confirm the deploy form or "
            "learning panel is visible."
        ),
    },
    {
        "name": "Navigation sweep",
        "prompt": (
            "Click through the main navigation links one by one and confirm "
            "each destination page renders content without an error screen."
        ),
    },
]


def _clip_text(value: Any, limit: int = 320) -> str:
    text = " ".join(str(value).split())
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


def _has_console_errors(console_errors: Any) -> bool:
    """Return True if the console_errors payload looks like it contains errors."""
    if not console_errors:
        return False
    if isinstance(console_errors, (list, tuple)):
        return len(console_errors) > 0
    return bool(console_errors)


def _parse_workflow_result(text: str) -> Optional[tuple[str, str]]:
    """Parse a WORKFLOW_RESULT line. Returns (verdict, reason) or None.

    verdict is "pass" or "fail".
    """
    if not text:
        return None
    # Find the marker anywhere in the text; take the remainder of that line.
    idx = text.find(WORKFLOW_RESULT_PREFIX)
    if idx == -1:
        return None
    remainder = text[idx + len(WORKFLOW_RESULT_PREFIX):]
    # Stop at the first newline.
    remainder = remainder.split("\n", 1)[0].strip()
    m = re.match(r"(PASS|FAIL)\s*:?\s*(.*)", remainder, re.IGNORECASE)
    if not m:
        return None
    verdict = m.group(1).lower()
    reason = m.group(2).strip() or ("Workflow passed." if verdict == "pass" else "Workflow failed.")
    return verdict, reason


def _build_user_prompt(workflow: str, target_url: str) -> str:
    return f"""You are a QA Engineer agent testing a live web application called "Sky Launchpad" as a real user would.

The app under test is at: {target_url}

Your task — execute this workflow exactly and validate the expected behavior:
{workflow}

Rules:
- You MUST use the provided Computer Use tools to interact with the live UI (navigate, click, type, scroll, etc.). Do not assume — actually perform the actions and observe the resulting screenshots.
- Behave like a real user. Keep going until the workflow goal is clearly achieved or clearly blocked.
- A modal closing automatically (e.g. after typing) is NOT a bug unless it prevents the workflow from completing. If an element interaction seems to fail, retry it before concluding failure.
- Be explicit about why the test passed or failed.

When you are finished, your final message MUST end with exactly one line in one of these forms:
  {WORKFLOW_RESULT_PREFIX} PASS: <short reason the workflow succeeded>
  {WORKFLOW_RESULT_PREFIX} FAIL: <short reason the workflow failed, including any bug observed>

Begin now.""".strip()


async def run_workflow(
    workflow: str,
    *,
    target_url: str,
    request_screenshot: Callable[[], Awaitable[bytes]],
    execute_action: Callable[[str, dict], Awaitable[dict]],
    emit: Callable[[dict], Awaitable[None]],
    max_turns: int = 20,
) -> dict:
    """Drive the live UI to accomplish `workflow` via the Computer Use vision-action loop.

    Args:
        workflow: Natural-language QA goal to accomplish.
        target_url: URL of the app under test.
        request_screenshot: async () -> bytes  (PNG of current viewport).
        execute_action: async (function_name, args) -> dict with keys
            {"screenshot": bytes, "url": str, "console_errors": list}.
        emit: async (event: dict) -> None  (stream events to the UI).
        max_turns: maximum model turns before giving up.

    Returns:
        {"verdict": "pass"|"fail"|"inconclusive",
         "summary": str,
         "bug": dict | None,
         "steps": list}
    """

    steps: list[dict] = []

    async def _emit(event: dict) -> None:
        try:
            await emit(event)
        except Exception:
            # Never let event streaming break the loop.
            pass

    def _finalize(verdict: str, summary: str, bug: Optional[dict]) -> dict:
        return {
            "verdict": verdict,
            "summary": summary,
            "bug": bug,
            "steps": steps,
        }

    async def _verdict_return(verdict: str, summary: str, bug: Optional[dict]) -> dict:
        await _emit({
            "kind": "verdict",
            "verdict": verdict,
            "summary": summary,
            "bug": bug,
        })
        return _finalize(verdict, summary, bug)

    # --- Lazy import of google-genai ---------------------------------------
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:  # ImportError or anything else
        await _emit({
            "kind": "status",
            "level": "error",
            "text": f"google-genai is unavailable: {_clip_text(exc, 200)}",
        })
        return await _verdict_return(
            "inconclusive",
            "Computer Use SDK (google-genai) is not available in this environment.",
            None,
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        await _emit({
            "kind": "status",
            "level": "error",
            "text": "GEMINI_API_KEY is not set; cannot run the Computer Use agent.",
        })
        return await _verdict_return(
            "inconclusive",
            "GEMINI_API_KEY is not configured.",
            None,
        )

    try:
        client = genai.Client(api_key=api_key)
    except Exception as exc:
        await _emit({
            "kind": "status",
            "level": "error",
            "text": f"Failed to initialize Gemini client: {_clip_text(exc, 200)}",
        })
        return await _verdict_return(
            "inconclusive",
            "Could not initialize the Gemini client.",
            None,
        )

    # Computer Use tool config (browser environment) — mirrors the reference.
    config = types.GenerateContentConfig(
        tools=[
            types.Tool(
                computer_use=types.ComputerUse(
                    environment=types.Environment.ENVIRONMENT_BROWSER,
                )
            )
        ],
        temperature=0.5,
    )

    # --- Seed the loop: navigate, then grab the first screenshot -----------
    last_url = target_url
    try:
        await _emit({
            "kind": "status",
            "level": "info",
            "text": f"Navigating to {target_url} to start workflow.",
        })
        nav_result = await execute_action("navigate", {"url": target_url})
        if isinstance(nav_result, dict):
            last_url = nav_result.get("url") or last_url
            if _has_console_errors(nav_result.get("console_errors")):
                # Surface but don't fail yet — let the agent observe.
                await _emit({
                    "kind": "status",
                    "level": "warning",
                    "text": "Console errors detected during initial navigation.",
                })
        initial_screenshot = await request_screenshot()
    except Exception as exc:
        await _emit({
            "kind": "status",
            "level": "error",
            "text": f"Failed to seed the workflow loop: {_clip_text(exc, 200)}",
        })
        return await _verdict_return(
            "inconclusive",
            "Could not navigate to the target URL or capture an initial screenshot.",
            None,
        )

    if not initial_screenshot:
        await _emit({
            "kind": "status",
            "level": "error",
            "text": "Initial screenshot was empty.",
        })
        return await _verdict_return(
            "inconclusive",
            "No initial screenshot was available to seed the agent.",
            None,
        )

    await _emit({
        "kind": "screenshot",
        "data": base64.b64encode(initial_screenshot).decode("ascii"),
        "url": last_url,
    })

    user_prompt = _build_user_prompt(workflow, target_url)

    # Conversation history.
    contents: list[Any] = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=user_prompt),
                types.Part.from_bytes(
                    data=initial_screenshot,
                    mime_type="image/png",
                ),
            ],
        )
    ]

    accumulated_bug: Optional[dict] = None
    turn_number = 0

    while turn_number < max_turns:
        turn_number += 1

        # --- Call the model ------------------------------------------------
        try:
            response = client.models.generate_content(
                model=COMPUTER_USE_MODEL_ID,
                contents=contents,
                config=config,
            )
        except Exception as exc:
            await _emit({
                "kind": "status",
                "level": "error",
                "text": f"generate_content failed on turn {turn_number}: {_clip_text(exc, 200)}",
            })
            return await _verdict_return(
                "inconclusive",
                f"Model call failed during turn {turn_number}.",
                accumulated_bug,
            )

        if not getattr(response, "candidates", None):
            await _emit({
                "kind": "status",
                "level": "warning",
                "text": f"No candidates returned on turn {turn_number}.",
            })
            return await _verdict_return(
                "inconclusive",
                "Model returned no candidates (possibly blocked by safety filters).",
                accumulated_bug,
            )

        candidate = response.candidates[0]
        candidate_content = candidate.content
        # Append model response to history so tool results align with it.
        contents.append(candidate_content)

        parts = list(getattr(candidate_content, "parts", None) or [])

        # --- Extract text (thoughts) and verdict ---------------------------
        thoughts = [
            part.text
            for part in parts
            if getattr(part, "text", None)
        ]
        combined_text = " ".join(thoughts).strip()
        if combined_text:
            await _emit({"kind": "thought", "text": combined_text})
            steps.append({"thought": _clip_text(combined_text, 500), "url": last_url})

        # --- Extract function calls ----------------------------------------
        function_calls = [
            part.function_call
            for part in parts
            if getattr(part, "function_call", None)
        ]

        if not function_calls:
            # No actions: look for a verdict.
            parsed = _parse_workflow_result(combined_text)
            if parsed:
                verdict, reason = parsed
                if verdict == "fail":
                    bug = accumulated_bug or {
                        "signal": reason,
                        "step": turn_number,
                        "console_errors": [],
                        "last_url": last_url,
                    }
                    # Prefer the model's stated reason as the signal if we
                    # synthesized the bug here.
                    if accumulated_bug is None:
                        bug["signal"] = reason
                    return await _verdict_return("fail", reason, bug)
                return await _verdict_return("pass", reason, accumulated_bug)

            # No actions and no verdict: nudge the model to conclude.
            await _emit({
                "kind": "status",
                "level": "info",
                "text": "No action or verdict returned; prompting agent for a final verdict.",
            })
            contents.append(
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(
                            text=(
                                "You did not take an action or provide a verdict. "
                                "If the workflow is complete or blocked, end your reply "
                                f"with a line: '{WORKFLOW_RESULT_PREFIX} PASS: <reason>' or "
                                f"'{WORKFLOW_RESULT_PREFIX} FAIL: <reason>'. Otherwise, "
                                "continue using the tools to make progress."
                            )
                        )
                    ],
                )
            )
            continue

        # --- Execute each function call ------------------------------------
        function_responses = []
        for function_call in function_calls:
            fn_name = function_call.name
            try:
                fn_args = dict(function_call.args) if function_call.args else {}
            except Exception:
                fn_args = {}

            message = _clip_text(combined_text, 160) if combined_text else f"Executing {fn_name}"
            await _emit({
                "kind": "action",
                "function_name": fn_name,
                "args": fn_args,
                "message": message,
            })
            steps.append({"action": fn_name, "args": fn_args, "url": last_url})

            try:
                result = await execute_action(fn_name, fn_args)
            except Exception as exc:
                # Action execution failed: report it back to the model so it can
                # recover, and record a potential bug signal.
                await _emit({
                    "kind": "status",
                    "level": "warning",
                    "text": f"Action '{fn_name}' raised: {_clip_text(exc, 160)}",
                })
                function_responses.append(
                    types.FunctionResponse(
                        name=fn_name,
                        response={
                            "url": last_url,
                            "status": "error",
                            "error": _clip_text(exc, 200),
                            "safety_acknowledgement": "true",
                        },
                        parts=[],
                    )
                )
                continue

            if not isinstance(result, dict):
                result = {}

            screenshot_bytes = result.get("screenshot") or b""
            result_url = result.get("url") or last_url
            last_url = result_url
            console_errors = result.get("console_errors") or []

            # Forward screenshot to the UI.
            if screenshot_bytes:
                await _emit({
                    "kind": "screenshot",
                    "data": base64.b64encode(screenshot_bytes).decode("ascii"),
                    "url": result_url,
                })

            # Console errors are a strong bug signal.
            if _has_console_errors(console_errors):
                await _emit({
                    "kind": "status",
                    "level": "warning",
                    "text": f"Console errors after '{fn_name}': {_clip_text(json.dumps(console_errors, default=str), 200)}",
                })
                accumulated_bug = {
                    "signal": "console_errors",
                    "step": turn_number,
                    "console_errors": list(console_errors)
                    if isinstance(console_errors, (list, tuple))
                    else [console_errors],
                    "last_url": result_url,
                }

            # Build the function response (with url) + screenshot for next turn.
            response_data: dict[str, Any] = {
                "url": result_url,
                "status": "executed",
                "safety_acknowledgement": "true",
            }
            if console_errors:
                response_data["console_errors"] = (
                    list(console_errors)
                    if isinstance(console_errors, (list, tuple))
                    else [console_errors]
                )

            fr_parts = []
            if screenshot_bytes:
                fr_parts.append(
                    types.FunctionResponsePart(
                        inline_data=types.FunctionResponseBlob(
                            mime_type="image/png",
                            data=screenshot_bytes,
                        )
                    )
                )

            function_responses.append(
                types.FunctionResponse(
                    name=fn_name,
                    response=response_data,
                    parts=fr_parts,
                )
            )

        # Append all tool results as a single user turn.
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(function_response=fr) for fr in function_responses],
            )
        )

    # --- Max turns reached without a verdict -------------------------------
    await _emit({
        "kind": "status",
        "level": "warning",
        "text": f"Reached max_turns ({max_turns}) without a final verdict.",
    })

    if accumulated_bug is not None:
        return await _verdict_return(
            "fail",
            "Console errors were detected but the workflow did not reach an explicit verdict before max_turns.",
            accumulated_bug,
        )

    return await _verdict_return(
        "inconclusive",
        f"The agent did not produce a {WORKFLOW_RESULT_PREFIX} verdict within {max_turns} turns.",
        None,
    )
