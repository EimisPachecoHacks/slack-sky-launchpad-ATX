# Demo Video Script (3 Minutes)

Use this script to record the hackathon submission demo video.

## Setup Before Recording

1. Have the project open in GitLab with the flow and agent enabled
2. Prepare an issue using the `infrastructure_request` template (pre-filled but not yet submitted)
3. Have the Automate > Sessions page ready in another tab
4. Open GitLab Duo Chat in the sidebar

---

## Script

### 0:00 - 0:20 | The Problem

> "Every developer knows the pain: you need infrastructure for a new feature, but writing
> Terraform from scratch takes hours. You need to figure out the right GCP services,
> security configurations, networking, IAM -- and then get it reviewed.
>
> What if your GitLab project could generate production-ready Terraform automatically?"

*Show: A blank `terraform/` directory or a new GitLab project*

### 0:20 - 0:50 | Trigger the Flow

> "With Skyrchitect, you just create an issue describing what you need."

*Action: Create the issue using the Infrastructure Request template*

> "I need a three-tier web app on GCP: load balancer, auto-scaling compute instances,
> Cloud SQL for PostgreSQL, and Redis for caching. Budget is $500 a month."

*Action: Submit the issue, then mention the service account in a comment*

> "Now I mention the Skyrchitect agent, and it takes over."

*Show: The @mention comment being posted*

### 0:50 - 1:30 | Watch the Flow

> "Behind the scenes, three AI agents work together as a flow on the GitLab Duo Agent Platform."

*Show: Automate > Sessions page with the flow running*

> "First, the Requirements Analyzer reads the issue and checks for existing Terraform
> in the repo. Then the IaC Generator creates complete Terraform files using five
> specialized Agent Skills -- for Terraform syntax, GCP security, cost optimization,
> and architecture patterns. Finally, the Code Committer creates a branch and opens
> a merge request."

*Show: The session progressing through agents (if visible in UI)*

### 1:30 - 2:20 | Review the Result

> "And here's the merge request."

*Action: Open the generated merge request*

> "It created a complete Terraform configuration: providers with version pinning, a VPC
> with private subnets and Cloud NAT, a managed instance group with autoscaler, Cloud
> SQL on a private IP with SSL and automated backups, Memorystore for Redis, and a
> load balancer."

*Action: Browse through the generated files (main.tf, variables.tf, outputs.tf)*

> "Variables have descriptions and validation. Outputs include the load balancer IP
> and database connection string. And there's a README explaining the architecture."

*Show: The issue comment linking back to the MR*

> "The original issue gets a comment with a summary and a link to the merge request."

### 2:20 - 2:50 | Interactive Chat

> "You can also chat with Skyrchitect interactively in GitLab Duo Chat."

*Action: Open GitLab Duo Chat, select the Skyrchitect agent*

> "How much would this architecture cost if I switched to Cloud Run instead of GCE?"

*Show: The agent responding with cost comparison and Terraform snippets*

> "It uses the same Agent Skills for real-time architecture advice."

### 2:50 - 3:00 | Wrap Up

> "Skyrchitect turns GitLab issues into production-ready GCP Terraform -- with security,
> cost optimization, and best practices built in. It's built entirely on the GitLab Duo
> Agent Platform with Gemma 4 on an AMD MI300X, five Agent Skills, and automated Terraform
> review instructions.
>
> From issue to infrastructure, in minutes instead of hours."

*Show: The project README with the architecture diagram*

---

## Recording Tips

- Use a clean browser profile (no bookmarks bar, minimal extensions)
- Zoom to 125% in GitLab for readability
- Use a screen resolution of 1920x1080
- Speak at a natural pace
- If the flow takes too long to complete live, use a pre-recorded session and narrate over it
- Keep the video under 3 minutes (judges are not required to watch beyond that)

---

## Voiceover — Skyrchitect product overview (original script + hosting)

Welcome to Skyrchitect — an AI-powered platform that transforms how teams design, validate, and deploy cloud infrastructure. Built on top of the GitLab Duo Agent Platform, Skyrchitect bridges the gap between architecture planning and real-world deployment.

Let me walk you through how it works.

In the first flow, a user starts by selecting their cloud provider — AWS, GCP, or Azure. Then they describe their project: a title, a description of what they need, and specific requirements like "a VPC with private subnets" or "a BigQuery dataset for analytics." Once submitted, this is where GitLab Duo takes over. The requirements are sent to the GitLab Duo Chat API through a GraphQL mutation. Duo analyzes everything and returns a complete architecture recommendation — services, connections, cost estimates, and alternatives — all as structured data. The result is rendered as an interactive diagram the user can review and adjust.

From there, the user moves to code generation. Again, GitLab Duo handles this. The architecture components are sent back to Duo with instructions to generate production-ready Terraform code. For larger architectures, the system splits the generation into multiple parts to avoid truncation. The user sees the full infrastructure-as-code on screen, ready to copy or download.

Then comes deployment. The user selects their cloud account — credentials they previously uploaded and stored securely — picks a region, and hits deploy. The backend runs a real Terraform workflow: init, plan, and apply against the actual cloud provider. If it fails, the system automatically analyzes the error logs, adjusts the code, and retries. Once deployment succeeds, the validated Terraform code is saved to GitLab. A dedicated Code Committer agent creates a branch, commits the files, and opens a Merge Request — all automatically. This is the deploy-first, validate-then-save philosophy. Code only reaches your repository after it has been proven to work.

Now the second flow. Instead of describing requirements, the user uploads an architecture diagram — a screenshot, a whiteboard photo, anything visual. Gemma 4 is natively multimodal, so a single call on the MI300X does both jobs at once: it reads the image and returns the architectural analysis — identifying services, estimating costs, and structuring everything into the same format as the first flow. The same open model that designs architectures also reads them. From that point, the experience is identical: diagram review, code generation, deployment, and GitLab commit.

The core intelligence flows through the GitLab Duo Agent Platform — every architecture analysis, every line of generated Terraform, every code commit is orchestrated by Duo. The system creates GitLab issues to track each request, generates merge requests for validated code, and logs every step for full traceability.

Skyrchitect proves that the GitLab Duo Agent Platform can power a complete infrastructure lifecycle — from a user's idea, all the way to deployed, validated, and version-controlled cloud resources. The Skyrchitect web application itself runs on **Google Cloud Platform** as **Cloud Run**: the container image is built with **`gcloud builds submit`**, pushed to **Artifact Registry**, and deployed with **`gcloud run deploy`** (e.g. **us-central1**).
