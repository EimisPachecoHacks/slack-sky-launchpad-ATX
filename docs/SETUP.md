# Setup Guide

Step-by-step instructions for setting up Skyrchitect in your GitLab project.

## Prerequisites

- GitLab.com account (Free tier or higher) or GitLab Self-Managed 18.9+
- Owner role on the target top-level group
- (Optional) Terraform CLI for validating examples locally

## Step 0: Activate GitLab Ultimate Trial (Required)

The GitLab Duo Agent Platform requires an Ultimate plan or active trial. Free-tier accounts
can activate a **30-day Ultimate trial** which includes **24 GitLab Credits per user** for
Duo Agent Platform features.

1. Go to your **top-level group > Settings > Billing**
2. Click **Start free trial**
3. Complete the form and select your group
4. Click **Activate my trial**

After activation, verify the trial is active — you should see a trial badge in the sidebar.

You can also run the automated check:

```bash
export GITLAB_TOKEN="your-token"
export GITLAB_PROJECT_PATH="your-group/your-project"
python3 scripts/setup_duo_platform.py --check
```

## Step 1: Import the Project

### Option A: Fork in the hackathon group

1. Navigate to this project
2. Click **Fork**
3. Select the target group/namespace

### Option B: Import to your own namespace

1. Go to **New project > Import project > Repository by URL**
2. Enter this project's URL
3. Select your namespace and create

## Step 2: Enable GitLab Duo

### On GitLab.com

1. Go to your **top-level group > Settings > GitLab Duo**
2. Click **Change configuration**
3. Enable:
   - **GitLab Duo** (main toggle)
   - **Allow flow execution**
   - **Allow foundational flows** (optional, for code review)
4. Save changes

### On GitLab Self-Managed

1. Go to **Admin > GitLab Duo**
2. Enable GitLab Duo and flow execution at the instance level
3. Then enable at the group level as above

## Step 3: Configure Runners

Flows run in CI/CD, so you need working runners.

**GitLab.com**: GitLab hosted runners are enabled by default. Verify at:
- **Project > Settings > CI/CD > Runners**
- Ensure shared runners are available

**Self-Managed**: [Configure your own runners](https://docs.gitlab.com/user/duo_agent_platform/flows/execution/#configure-runners) with Docker executor.

## Step 4: Create the Custom Flow

1. Go to **Automate > Flows**
2. Click **New flow** (or from AI Catalog)
3. Fill in:
   - **Display name**: `Skyrchitect IaC Generator`
   - **Description**: `Generates GCP Terraform infrastructure from issue requirements. Creates complete Terraform file sets and opens merge requests automatically.`
4. Under **Configuration**, select **Flow**
5. Paste the full contents of [`flows/skyrchitect-iac-generator.yaml`](../flows/skyrchitect-iac-generator.yaml)
6. Click **Create flow**

## Step 5: Enable the Flow

1. Select the flow you just created
2. Click **Enable** in the upper-right corner
3. Select your project
4. Under **Add triggers**, select:
   - **Mention** -- triggered when the service account is @mentioned
   - **Assign** -- triggered when the service account is assigned to an issue
5. Click **Enable**

A service account is automatically created (named `ai-skyrchitect-iac-generator-<group>`).

## Step 6: Create the Custom Agent (Optional)

1. Go to **Automate > Agents**
2. Click **New agent**
3. Follow the configuration in [`agents/skyrchitect-chat-agent.md`](../agents/skyrchitect-chat-agent.md):
   - Copy the system prompt
   - Select the listed tools
   - Set visibility to **Public**
4. Click **Create agent**
5. Enable the agent in your project

## Step 7: Test It

### Test the flow

1. Create a new issue using the **Infrastructure Request** template
2. Fill in the requirements (or copy from `examples/sample-issues/`)
3. In a comment, mention the service account:
   ```
   @ai-skyrchitect-iac-generator-<your-group> Please generate the infrastructure for this request.
   ```
4. Monitor progress at **Automate > Sessions**
5. When complete, check for the new merge request

### Test the chat agent

1. Open any issue or MR in your project
2. Open GitLab Duo Chat (sidebar)
3. Select **Skyrchitect** from the agent dropdown
4. Ask: "What GCP architecture would you recommend for a serverless API handling 1000 rps?"

## Troubleshooting

### Flow doesn't trigger

- Verify the flow is enabled in your project (**Automate > Flows > Enabled tab**)
- Check that triggers are set (mention / assign)
- Ensure you're mentioning the correct service account name
- Verify GitLab Duo and flow execution are enabled in group settings

### Flow fails during execution

- Check the session logs at **Automate > Sessions**
- Verify runners are available and working
- Check that the project has CI/CD minutes available

### Agent not available in chat

- Verify the agent is enabled in your project (**Automate > Agents > Enabled tab**)
- Start a **new** chat conversation (existing ones don't pick up new agents)
- Check that you have the correct IDE extension version (VS Code 6.47.0+, JetBrains 3.19.0+)

### Skills not loading

- Verify `SKILL.md` files are in the correct location (`skills/<name>/SKILL.md`)
- Start a new conversation (skills load at session start)
- Check that files are committed to the repository (not just local)
