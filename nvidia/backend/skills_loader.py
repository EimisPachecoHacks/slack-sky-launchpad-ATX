"""
Sky Launchpad Autopilot — Skills Loader

Loads the workspace agent skills (SKILL.md files) that provide domain-specific
knowledge context for the Qwen IaC Generator agent and its repair loop.

Skills loaded:
  - terraform-gcp-generator:   HCL patterns, provider config, resource templates
  - gcp-architecture-patterns: Reference architectures (three-tier, serverless, etc.)
  - gcp-security-hardening:    IAM, firewall, encryption, compliance controls
  - gcp-cost-optimizer:        Right-sizing, lifecycle rules, discount strategies
"""

import logging
import os
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent
_SKILLS_DIR = _REPO_ROOT / "skills"

SKILL_NAMES = [
    "terraform-gcp-generator",
    "gcp-architecture-patterns",
    "gcp-security-hardening",
    "gcp-cost-optimizer",
]


def load_learned_skills() -> dict[str, str]:
    """Load auto-authored skills from skills/learned/.

    These are written by the self-improvement loop (deployer/skill_library.py) after
    a deployment failure is diagnosed. Reading them here is the *transfer* mechanism:
    a lesson learned on one deployment is injected into the next one's generation
    prompt, so the same failure is pre-empted. Not cached — it changes at runtime.
    """
    learned: dict[str, str] = {}
    learned_dir = _SKILLS_DIR / "learned"
    if not learned_dir.exists():
        return learned
    for skill_md in sorted(learned_dir.glob("*/SKILL.md")):
        try:
            learned[skill_md.parent.name] = skill_md.read_text(encoding="utf-8")
        except OSError:
            continue
    return learned


@lru_cache(maxsize=1)
def load_all_skills() -> dict[str, str]:
    """Load all SKILL.md files and return {name: content} mapping."""
    skills = {}
    for name in SKILL_NAMES:
        path = _SKILLS_DIR / name / "SKILL.md"
        if path.exists():
            content = path.read_text(encoding="utf-8")
            skills[name] = content
            logger.info(f"Loaded skill: {name} ({len(content)} chars)")
        else:
            logger.warning(f"Skill not found: {path}")
    return skills


def get_skills_context(provider: str = "gcp") -> str:
    """
    Build a formatted prompt context string from all relevant skills.

    This is injected into each Qwen IaC generation and repair prompt.
    """
    skills = load_all_skills()
    if not skills:
        return ""

    sections = [
        "=== SKY LAUNCHPAD WORKSPACE AGENT SKILLS ===",
        "",
        "The following knowledge bases provide authoritative patterns and best",
        "practices. Use them as reference when generating infrastructure code.",
        "",
    ]

    for name, content in skills.items():
        sections.append(f"--- SKILL: {name} ---")
        sections.append(content)
        sections.append("")

    learned = load_learned_skills()
    for slug, content in learned.items():
        sections.append(
            f"--- LEARNED SKILL (auto-authored from a past deployment failure): {slug} ---"
        )
        sections.append(content)
        sections.append("")

    sections.append("=== END SKILLS CONTEXT ===")
    return "\n".join(sections)


def get_skills_summary() -> list[dict]:
    """Return a summary of loaded skills for API responses."""
    skills = load_all_skills()
    return [
        {"name": name, "loaded": name in skills, "chars": len(skills.get(name, ""))}
        for name in SKILL_NAMES
    ]
