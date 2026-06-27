# Contributing to Skyrchitect

Thank you for your interest in contributing to Skyrchitect. This guide explains how to extend the project with new skills, flow modifications, and cloud provider support.

## Adding a New Agent Skill

Agent Skills are the primary extension point. Each skill teaches the agent specialized knowledge.

### Steps

1. Create a directory under `skills/` with a descriptive name:
   ```
   skills/my-new-skill/SKILL.md
   ```

2. Write the `SKILL.md` with required front matter:
   ```markdown
   ---
   name: my-new-skill
   description: Brief description of what this skill teaches the agent.
   metadata:
     slash-command: enabled
   ---

   ## My New Skill

   Detailed instructions, code patterns, and reference material...
   ```

3. Include practical examples with code blocks that the agent can use directly.

4. Test the skill by starting a new GitLab Duo Chat session and using `/my-new-skill` or asking a question that matches the skill description.

### Skill Writing Guidelines

- Keep instructions specific and actionable
- Include complete code examples, not fragments
- Add cost estimates where relevant
- Include a "checklist" section for verification
- Reference official documentation where appropriate

## Modifying the Flow

The flow configuration lives in `flows/skyrchitect-iac-generator.yaml`.

### Adding a New Agent to the Flow

1. Define the component in the `components` section
2. Add a prompt in the `prompts` section
3. Update the `routers` section to connect it
4. Test by creating a new flow in the GitLab UI with your modified YAML

### Prompt Guidelines

- Be specific about the expected output format
- Include examples in the system prompt
- Set appropriate timeouts (120s for analysis, 300s for generation)
- Always reference which tools the agent should use

## Adding Cloud Provider Support

To add support for a new cloud provider (e.g., AWS, Azure):

1. Create provider-specific skills:
   - `skills/terraform-aws-generator/SKILL.md`
   - `skills/aws-security-hardening/SKILL.md`
   - `skills/aws-cost-optimizer/SKILL.md`
   - `skills/aws-architecture-patterns/SKILL.md`

2. Create example Terraform configurations:
   - `examples/terraform/aws-three-tier-webapp/`
   - (etc.)

3. Update the flow prompts to handle provider selection based on issue content.

4. Update `.gitlab/duo/chat-rules.md` to support the new provider.

5. Add review instructions for provider-specific patterns in `.gitlab/duo/mr-review-instructions.yaml`.

## Adding Example Terraform Configurations

Place new examples under `examples/terraform/<pattern-name>/` with the standard file set:

- `providers.tf`
- `main.tf`
- `variables.tf`
- `outputs.tf`
- `terraform.tfvars.example`
- `README.md`

Validate with:
```bash
cd examples/terraform/<pattern-name>
terraform fmt -check
terraform init -backend=false
terraform validate
```

## Code of Conduct

- Be respectful and constructive in all interactions
- Focus on technical quality and user impact
- Test your changes before submitting

## Submitting Changes

1. Fork the project
2. Create a feature branch
3. Make your changes
4. Ensure all Terraform examples validate (`tests/validate-terraform.sh`)
5. Submit a merge request with a clear description
