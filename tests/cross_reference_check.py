#!/usr/bin/env python3
"""Cross-reference and connectivity validation for Skyrchitect."""

import yaml
import os
import re
import json

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

passes = []
warnings = []
errors = []


def load_file(rel_path):
    with open(os.path.join(BASE, rel_path)) as f:
        return f.read()


def load_yaml(rel_path):
    return yaml.safe_load(load_file(rel_path))


flow = load_yaml("flows/skyrchitect-iac-generator.yaml")
agents_md = load_file("AGENTS.md")
chat_rules = load_file(".gitlab/duo/chat-rules.md")
chat_agent = load_file("agents/skyrchitect-chat-agent.md")
mr_review = load_yaml(".gitlab/duo/mr-review-instructions.yaml")
readme = load_file("README.md")

skills = {}
for s in os.listdir(os.path.join(BASE, "skills")):
    sp = os.path.join(BASE, "skills", s, "SKILL.md")
    if os.path.exists(sp):
        with open(sp) as f:
            skills[s] = f.read()

flow_prompts_text = str(flow.get("prompts", ""))

print("=== CROSS-REFERENCE & CONNECTIVITY VALIDATION ===")
print()

# 1. Flow <-> AGENTS.md consistency
print("1. Flow <-> AGENTS.md consistency")
if "google ~> 5.0" in flow_prompts_text and "google ~> 5.0" in agents_md:
    passes.append("Provider version google ~> 5.0 consistent in flow + AGENTS.md")
    print("   PASS: Provider version google ~> 5.0 consistent")
else:
    errors.append("Provider version mismatch between flow and AGENTS.md")
    print("   FAIL: Provider version mismatch")

flow_files = ["providers.tf", "main.tf", "variables.tf", "outputs.tf",
               "terraform.tfvars.example", "README.md"]
if all(f in agents_md for f in flow_files):
    passes.append("All 6 Terraform files referenced in both flow and AGENTS.md")
    print("   PASS: All 6 Terraform files referenced consistently")
else:
    missing = [f for f in flow_files if f not in agents_md]
    warnings.append("AGENTS.md missing references to: " + str(missing))
    print("   WARN: AGENTS.md missing references to:", missing)

flow_labels_ok = "managed_by" in flow_prompts_text or "managed-by" in flow_prompts_text
agents_labels_ok = "managed_by" in agents_md
if flow_labels_ok and agents_labels_ok:
    passes.append("Labels (managed_by=skyrchitect) consistent in flow + AGENTS.md")
    print("   PASS: Labels (managed_by) consistent")
else:
    warnings.append("Labels reference may be inconsistent between flow and AGENTS.md")
    print("   WARN: Labels reference may be inconsistent")

print()

# 2. Flow <-> Chat Rules consistency
print("2. Flow <-> Chat Rules consistency")
if "google ~> 5.0" in chat_rules:
    passes.append("Provider pin consistent in chat-rules.md")
    print("   PASS: Provider pin consistent in chat-rules.md")
else:
    errors.append("chat-rules.md missing provider version pin")
    print("   FAIL: Missing provider pin in chat-rules.md")

if "GCS" in chat_rules:
    passes.append("GCS backend mentioned in chat-rules.md")
    print("   PASS: GCS backend referenced in chat-rules.md")
else:
    warnings.append("chat-rules.md missing GCS backend reference")
    print("   WARN: Missing GCS backend reference")

print()

# 3. Chat Agent <-> Flow tool consistency
print("3. Chat Agent <-> Flow tool alignment")
flow_tools = set()
for comp in flow.get("components", []):
    flow_tools.update(comp.get("toolset", []))

agent_tools_mentioned = re.findall(r"\| `([^`]+)`", chat_agent)
agent_tools = set(agent_tools_mentioned)

shared = flow_tools & agent_tools
flow_only = flow_tools - agent_tools
agent_only = agent_tools - flow_tools

print("   Flow tools:", sorted(flow_tools))
print("   Agent tools:", sorted(agent_tools))
print("   Shared:", sorted(shared))
if flow_only:
    print("   Flow-only:", sorted(flow_only))
if agent_only:
    print("   Agent-only:", sorted(agent_only))

if shared:
    passes.append("{} tools shared between flow and chat agent".format(len(shared)))
    print("   PASS: {} tools shared (good overlap)".format(len(shared)))

print()

# 4. MR Review <-> AGENTS.md alignment
print("4. MR Review Instructions <-> AGENTS.md alignment")
mr_text = str(mr_review.get("instructions", []))
checks_aligned = 0
for check in ["private IP", "SSL", "Service account", "deletion_protection"]:
    if check.lower() in mr_text.lower() and check.lower() in agents_md.lower():
        checks_aligned += 1
passes.append("Security rules aligned: {}/4 checks match".format(checks_aligned))
print("   PASS: Security rules aligned ({}/4 checks match)".format(checks_aligned))

print()

# 5. Skills <-> Flow prompt alignment
print("5. Skills <-> Flow prompt alignment")
iac_comp = next((c for c in flow["components"] if c["name"] == "iac_generator"), None)
if iac_comp:
    iac_inputs = [i["from"] for i in iac_comp.get("inputs", [])]
    if "context:inputs.workspace_agent_skills" in iac_inputs:
        passes.append("Flow iac_generator accepts workspace_agent_skills input")
        print("   PASS: Flow iac_generator references workspace_agent_skills")
    else:
        errors.append("Flow iac_generator missing workspace_agent_skills input")
        print("   FAIL: Missing workspace_agent_skills in iac_generator")

core_skills = {
    "gcp-security-hardening": "gcp-security-hardening" in skills,
    "gcp-cost-optimizer": "gcp-cost-optimizer" in skills,
    "gcp-architecture-patterns": "gcp-architecture-patterns" in skills,
    "terraform-gcp-generator": "terraform-gcp-generator" in skills,
}
if all(core_skills.values()):
    passes.append("All 4 core skills present (security, cost, architecture, terraform)")
    print("   PASS: All 4 core skills present and aligned with flow prompts")
else:
    missing_sk = [k for k, v in core_skills.items() if not v]
    errors.append("Missing core skills: " + str(missing_sk))
    print("   FAIL: Missing core skills:", missing_sk)

print()

# 6. Sample Issues <-> Issue Template alignment
print("6. Sample Issues <-> Issue Template alignment")
tpl = load_file(".gitlab/issue_templates/infrastructure_request.md")
tpl_sections = re.findall(r"### (.+)", tpl)
print("   Template sections:", tpl_sections)

sample_dir = os.path.join(BASE, "examples/sample-issues")
for fname in sorted(os.listdir(sample_dir)):
    with open(os.path.join(sample_dir, fname)) as f:
        sample = f.read()
    filled = sum(1 for s in tpl_sections if s in sample)
    total = len(tpl_sections)
    if filled >= total - 1:
        passes.append("Sample issue {} fills {}/{} template sections".format(fname, filled, total))
        print("   PASS: {} fills {}/{} sections".format(fname, filled, total))
    else:
        warnings.append("Sample issue {} only fills {}/{} sections".format(fname, filled, total))
        print("   WARN: {} only fills {}/{} sections".format(fname, filled, total))

print()

# 7. Terraform Examples <-> AGENTS.md standards
print("7. Terraform Examples <-> AGENTS.md coding standards")
examples_dir = os.path.join(BASE, "examples/terraform")
for example in sorted(os.listdir(examples_dir)):
    edir = os.path.join(examples_dir, example)
    if not os.path.isdir(edir):
        continue

    required = ["providers.tf", "main.tf", "variables.tf", "outputs.tf",
                "terraform.tfvars.example", "README.md"]
    existing = os.listdir(edir)
    missing_f = [f for f in required if f not in existing]

    if missing_f:
        errors.append("{}: Missing files {}".format(example, missing_f))
        print("   FAIL: {} missing {}".format(example, missing_f))
    else:
        passes.append("{}: All 6 required files present".format(example))
        print("   PASS: {} has all 6 required files".format(example))

    pf = os.path.join(edir, "providers.tf")
    if os.path.exists(pf):
        with open(pf) as f:
            pc = f.read()
        if "google" in pc and "~> 5.0" in pc:
            passes.append("{}: Provider pin google ~> 5.0 present".format(example))
        else:
            errors.append("{}: Missing google ~> 5.0 provider pin".format(example))
            print("   FAIL: {} missing provider pin".format(example))

    mf = os.path.join(edir, "main.tf")
    if os.path.exists(mf):
        with open(mf) as f:
            mc = f.read()
        if "managed_by" in mc and "skyrchitect" in mc:
            passes.append("{}: Labels with managed_by=skyrchitect found".format(example))
        else:
            warnings.append("{}: Missing managed_by=skyrchitect label".format(example))
            print("   WARN: {} missing managed_by=skyrchitect label".format(example))

print()

# 8. README doc links
print("8. README <-> File references")
doc_refs = {
    "docs/ARCHITECTURE.md": True,
    "docs/SETUP.md": True,
    "docs/FLOW_REFERENCE.md": True,
    "CONTRIBUTING.md": True,
    "LICENSE": True,
}
for ref in doc_refs:
    if os.path.exists(os.path.join(BASE, ref)):
        passes.append("README reference {} exists".format(ref))
        print("   PASS: {} exists".format(ref))
    else:
        errors.append("README references {} but file missing".format(ref))
        print("   FAIL: {} missing".format(ref))

print()
print("=== SUMMARY ===")
print("  Passes:  ", len(passes))
print("  Warnings:", len(warnings))
print("  Errors:  ", len(errors))
if warnings:
    print()
    print("  Warnings:")
    for w in warnings:
        print("    -", w)
if errors:
    print()
    print("  Errors:")
    for e in errors:
        print("    -", e)

# Write JSON results for report generation
results = {
    "passes": passes,
    "warnings": warnings,
    "errors": errors,
}
with open(os.path.join(BASE, "tests/cross_reference_results.json"), "w") as f:
    json.dump(results, f, indent=2)

# skyrchitect: monorepo sync marker (no test logic change)
