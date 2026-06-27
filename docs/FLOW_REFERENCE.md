# Flow YAML Reference

Detailed explanation of the Skyrchitect flow configuration.

## File Location

[`flows/skyrchitect-iac-generator.yaml`](../flows/skyrchitect-iac-generator.yaml)

## Top-Level Structure

```yaml
version: "v1"          # Flow registry framework version
environment: ambient    # Runs in background, triggered by events
```

- **`version`**: Always `"v1"` for the current framework
- **`environment`**: `ambient` means the flow runs autonomously without interactive human input. Custom flows only support `ambient` (not `chat` or `chat-partial`).

## Components

Three `AgentComponent` instances form the pipeline:

### requirements_analyzer

```yaml
- name: "requirements_analyzer"
  type: AgentComponent
  prompt_id: "skyrchitect_requirements_analyzer"
  inputs:
    - from: "context:goal"
      as: "issue_context"
  toolset:
    - "get_issue"
    - "list_issue_notes"
    - "list_repository_tree"
    - "get_repository_file"
```

| Field | Purpose |
|-------|---------|
| `prompt_id` | References the locally defined prompt (see Prompts section) |
| `inputs` | Receives the flow trigger context as `issue_context` |
| `toolset` | Read-only tools for issue and repo inspection |

**Output**: `context:requirements_analyzer.final_answer` -- structured JSON requirements.

### iac_generator

```yaml
- name: "iac_generator"
  type: AgentComponent
  prompt_id: "skyrchitect_iac_generator"
  inputs:
    - from: "context:requirements_analyzer.final_answer"
      as: "requirements"
    - from: "context:inputs.workspace_agent_skills"
      as: "workspace_agent_skills"
      optional: true
  toolset:
    - "get_repository_file"
    - "list_repository_tree"
    - "gitlab_blob_search"
```

| Field | Purpose |
|-------|---------|
| `inputs[0]` | Takes structured requirements from the analyzer |
| `inputs[1]` | Loads Agent Skills from the workspace (optional, graceful if none exist) |
| `toolset` | Read-only tools for inspecting existing code |

**Output**: `context:iac_generator.final_answer` -- JSON map of filename-to-content.

### code_committer

```yaml
- name: "code_committer"
  type: AgentComponent
  prompt_id: "skyrchitect_code_committer"
  inputs:
    - from: "context:requirements_analyzer.final_answer"
      as: "requirements"
    - from: "context:iac_generator.final_answer"
      as: "generated_code"
  toolset:
    - "create_commit"
    - "create_merge_request"
    - "create_issue_note"
```

| Field | Purpose |
|-------|---------|
| `inputs` | Receives both requirements (for issue reference) and generated code |
| `toolset` | Write tools for creating branches, commits, MRs, and comments |

## Prompts

Prompts are defined locally in the YAML (not in a separate prompt registry). Each prompt has:

- `prompt_id` -- Referenced by the component
- `prompt_template.system` -- Defines the agent's role, behavior, and output format
- `prompt_template.user` -- Template with `{{variable}}` placeholders filled from inputs
- `params.timeout` -- Maximum execution time in seconds

### Key Prompt Design Decisions

1. **Structured outputs**: Each agent specifies the exact JSON format expected, ensuring clean handoffs between agents.

2. **Tool guidance**: System prompts explicitly instruct which tools to use and when, reducing unnecessary tool calls.

3. **Best practices baked in**: Security, cost, and quality rules are embedded in the generator prompt rather than relying solely on skills, ensuring they apply even if skills fail to load.

4. **Timeout scaling**: The analyzer gets 120s (simple extraction), the generator gets 300s (complex code generation), and the committer gets 180s (API calls).

## Routers

```yaml
routers:
  - from: "requirements_analyzer"
    to: "iac_generator"
  - from: "iac_generator"
    to: "code_committer"
  - from: "code_committer"
    to: "end"
```

Linear pipeline: analyzer -> generator -> committer -> end. The `"end"` keyword terminates the flow.

For more complex flows, routers can include conditional routing based on agent outputs (e.g., routing to different generators based on detected cloud provider).

## Flow Entry Point

```yaml
flow:
  entry_point: "requirements_analyzer"
```

The flow always starts with the requirements analyzer.

## Custom Flow Restrictions

Per the [custom flow YAML schema](https://docs.gitlab.com/user/duo_agent_platform/flows/custom_flows_schema/), these v1 spec features are restricted:

| Feature | Restriction |
|---------|-------------|
| `environment` | Only `ambient` (no `chat` or `chat-partial`) |
| `model` in prompts | Not supported (model determined by group/instance settings) |
| `response_schema_id` | Not supported in custom flows |
| `ui_role_as` | Not supported |
| `stop` in params | Not supported |
| `name`, `description`, `product_group` | Top-level fields not supported |
