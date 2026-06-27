# Skyrchitect

**AI-powered cloud architect that transforms GitLab issues into production-ready GCP Terraform infrastructure in seconds.**

<!-- Add project banner/logo image here -->
<!-- ![Skyrchitect Banner](images/banner.png) -->

---

## Inspiration

Every cloud infrastructure journey starts the same way: someone describes what they need, and then a DevOps engineer spends hours — sometimes days — translating those requirements into production-grade Terraform code. For teams without dedicated cloud engineers, this bottleneck is even worse. They struggle with GCP best practices, miss critical security configurations, overpay for resources, and end up with fragile infrastructure that's hard to maintain.

We saw this gap firsthand: the distance between _describing_ what you need and _having_ production-ready Infrastructure as Code is enormous. Manual Terraform authoring demands deep expertise in cloud networking, IAM, encryption, cost optimization, and compliance — knowledge that's expensive and scarce.

Skyrchitect was built to eliminate that gap entirely. Our goal was to bring GitLab's DevSecOps philosophy directly into infrastructure provisioning — so that any developer can describe their infrastructure needs in a GitLab issue and receive a complete, secure, cost-optimized Terraform configuration delivered as a merge request, ready for review and deployment.

## What it does

Skyrchitect is an AI-powered infrastructure architect that lives inside your GitLab workflow. It reads a GitLab issue describing infrastructure requirements, generates complete GCP Terraform configurations, and delivers them as a merge request — fully automated, end to end.

### Three-Agent Pipeline

The core of Skyrchitect is a GitLab Duo flow with three specialized AI agents working in sequence:

| Agent | Purpose | What It Does |
|-------|---------|--------------|
| **Requirements Analyzer** | Parse natural language into structured specs | Reads the GitLab issue and comments, scans existing repo Terraform files, and outputs a structured JSON requirements specification with architecture pattern, GCP services, scale, security needs, and budget |
| **IaC Generator** | Generate production-ready Terraform | Takes the structured requirements and produces a complete 6-file Terraform configuration: `providers.tf`, `main.tf`, `variables.tf`, `outputs.tf`, `terraform.tfvars.example`, and `README.md` |
| **Code Committer** | Automate the GitLab workflow | Creates a feature branch, commits all generated files, opens a merge request with architecture overview and cost estimates, and comments on the original issue with a summary |

```
GitLab Issue (natural language)
       │
       ▼
┌─────────────────────────┐
│  Requirements Analyzer  │──▶ Structured JSON spec
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│     IaC Generator       │──▶ 6 Terraform files
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│    Code Committer       │──▶ Branch + Commit + Merge Request
└─────────────────────────┘
```

### Five Reference Architecture Patterns

Skyrchitect supports five production-proven GCP architecture patterns out of the box:

| Architecture | Use Case | Estimated Cost |
|-------------|----------|----------------|
| **Three-Tier Web App** | Traditional web applications with load balancing, compute, database, and CDN | ~$150–800/mo |
| **Serverless API** | Event-driven APIs with Cloud Run, Firestore, and Pub/Sub | ~$5–200/mo |
| **Data Pipeline** | ETL/analytics with Cloud Storage, Pub/Sub, BigQuery, and Cloud Scheduler | ~$50–2,000/mo |
| **Container Orchestration (GKE)** | Microservices on private GKE clusters with Artifact Registry | ~$200–2,000/mo |
| **Multi-Region / DR** | Mission-critical workloads with cross-region replication and Cloud Spanner | Custom |

### Security-First Defaults

Every generated configuration includes security hardening by default — no extra configuration needed:

| Security Layer | Default Configuration |
|---------------|----------------------|
| **Networking** | Custom VPC, deny-all firewall, private subnets, Cloud NAT |
| **Database** | Private IP only, SSL enforced, automated backups, deletion protection in prod |
| **IAM** | Per-workload service accounts, least-privilege roles, no `roles/owner` or `roles/editor` |
| **Encryption** | Cloud KMS CMEK when compliance requires, Secret Manager for credentials |
| **Audit** | Cloud Audit Logs enabled (admin read, data read, data write) |
| **Compliance** | Mappings for SOC2, HIPAA, PCI DSS, ISO 27001 |

### Interactive Chat Agent

Beyond the automated flow, Skyrchitect also works as an interactive chat agent through GitLab Duo. Developers can ask it to:

- Design GCP architectures based on requirements
- Generate Terraform code snippets on demand
- Review existing Terraform in merge requests for security and cost issues
- Estimate infrastructure costs
- Explain architecture trade-offs

Available in the **GitLab UI**, **VS Code**, and **JetBrains IDEs**.

### Voice Input Integration

Skyrchitect integrates **ElevenLabs Scribe v2 Realtime** for voice-based infrastructure requirement capture. Users can describe their infrastructure needs verbally with ~150ms latency real-time transcription, which feeds directly into GitLab issue creation or chat interactions — making infrastructure provisioning as easy as talking.

### Automated MR Review

Every generated merge request is paired with a comprehensive review checklist covering:
- Terraform configuration quality (provider pinning, state backend, version constraints)
- Security validation (no hardcoded secrets, private IPs, SSL enforcement, least-privilege IAM)
- Cost efficiency (right-sized instances, lifecycle rules, environment-aware scaling)
- Code standards (variable validation, naming conventions, labels, documentation)

## How we built it

Skyrchitect is built on the **GitLab Duo Agent Platform** with a companion React UI for interactive architecture design and real cloud deployment:

### GitLab Duo Agent Platform Components

- **Custom Flow** (`flows/skyrchitect-iac-generator.yaml`): A three-component ambient pipeline orchestrating the Requirements Analyzer, IaC Generator, and Code Committer agents with typed inputs, tool access, and locally defined prompts following the flow registry v1 specification.

- **Custom Agent** (`agents/skyrchitect-chat-agent.md`): An interactive chat agent configured with 11 GitLab tools (issue reading, file browsing, code search, commit creation, MR management) and a specialized system prompt for GCP architecture expertise. Available in GitLab Duo Chat, VS Code, and JetBrains.

- **Five Agent Skills** — reusable knowledge bases loaded automatically by agents:
  - **Terraform GCP Generator**: Complete HCL patterns for all major GCP services
  - **GCP Security Hardening**: Defense-in-depth security configurations
  - **GCP Cost Optimizer**: Pricing models, right-sizing strategies
  - **GCP Architecture Patterns**: Five reference architectures with cost estimates
  - **Voice Input Integration**: ElevenLabs Scribe v2 companion for voice-based input

- **Project Customization**: `AGENTS.md` for project context, `.gitlab/duo/chat-rules.md` for behavior rules, `.gitlab/duo/mr-review-instructions.yaml` for automated MR review criteria.

- **CI/CD Pipeline** (`.gitlab-ci.yml`): Automated Terraform validation, skills structure checks, and flow YAML compliance on every merge request.

### Companion Application (React + FastAPI)

- **React Frontend**: Interactive UI for describing infrastructure needs, viewing generated architectures, and triggering deployments with real-time progress tracking.
- **FastAPI Backend**: Mirrors the Duo Flow pipeline (3-agent sequence) for a deploy-first-validate-then-save workflow. After successful cloud deployment, commits validated Terraform to GitLab via the API.
- **Deploy-First Workflow**: Unlike the standard flow that generates code into an MR for review, the companion app actually deploys the generated Terraform to a real cloud environment (AWS or GCP), validates it works, then saves the deployment-proven code to GitLab as a merge request.

## Accomplishments that we're proud of

- **True end-to-end automation**: From a plain-English GitLab issue to a fully-formed merge request with production-ready Terraform — zero manual steps in between.

- **Security by default, not by afterthought**: Every generated configuration ships with private networking, least-privilege IAM, encryption, and audit logging. Developers get secure infrastructure without needing to be security experts.

- **Cost-aware code generation**: Resources are right-sized per environment (dev/staging/prod), include cost estimation comments, and suggest optimizations like committed use discounts and spot VMs.

- **Voice-powered infrastructure**: By integrating ElevenLabs Scribe v2, we made infrastructure provisioning accessible through speech — describe what you need, and Skyrchitect builds it.

- **Quality gates built in**: The automated MR review checklist ensures that generated code meets security, cost, and quality standards before it ever reaches a human reviewer.

- **Five architecture patterns on day one**: Not just a code generator — Skyrchitect understands architecture. It selects the right pattern (serverless, three-tier, data pipeline, GKE, multi-region) based on the requirements and generates the complete topology.

## What we learned

Building Skyrchitect taught us that **Infrastructure as Code generation is fundamentally a workflow design problem**, not just a code generation problem. The challenge isn't producing syntactically correct Terraform — it's understanding requirements, applying the right architecture pattern, enforcing security constraints, optimizing for cost, and integrating seamlessly into the developer's existing workflow.

We learned that **skill modules as reusable knowledge bases** are the key to consistent, high-quality agent output. By encoding GCP best practices, security hardening rules, cost optimization strategies, and architecture patterns as structured reference documents, we gave the agents deep domain expertise that produces reliable results across diverse infrastructure requests.

We also discovered the power of the **GitLab Duo Agent Platform** for building complex multi-agent workflows. The flow system's ability to chain agents with typed inputs and structured outputs, combined with native GitLab tool access (issues, commits, merge requests), made it possible to build a sophisticated automation pipeline without any custom server infrastructure.

## What's next for Skyrchitect

- **Multi-cloud expansion**: Extend beyond GCP to support AWS (CloudFormation/Terraform) and Azure (Terraform), enabling teams to generate infrastructure for any major cloud provider
- **`terraform plan` validation**: Run `terraform plan` on generated code before creating the MR, catching configuration errors before human review
- **Drift detection and remediation**: Monitor deployed infrastructure for configuration drift and automatically generate corrective Terraform
- **More architecture patterns**: Add support for ML pipelines (Vertex AI), IoT platforms, hybrid cloud, and edge computing topologies
- **Cost forecasting dashboards**: Generate cost projection reports alongside Terraform code, showing expected spend across environments and growth scenarios
- **Multi-environment orchestration**: Generate linked dev/staging/prod configurations with promotion workflows built in

## Built with

- GitLab Duo Agent Platform (Custom Flow, Custom Agent, Agent Skills)
- GitLab Duo Flows (v1 flow registry, ambient environment)
- GitLab Duo Custom Agents (interactive chat agent with 11 tools)
- GitLab CI/CD (Terraform validation pipeline)
- Google Cloud Platform (GCP)
- Terraform (HCL)
- React + TypeScript (companion UI)
- FastAPI + Python (companion backend)
- Anthropic Claude (via GitLab Duo AI Gateway and direct API)
- ElevenLabs Scribe v2 (voice input)
- Infrastructure as Code
- DevSecOps

## Media

<!-- Replace these placeholders with actual screenshots and links -->

### Screenshots

<!-- ![Pipeline Flow](images/pipeline-flow.png) -->
`[Screenshot: Skyrchitect 3-agent pipeline flow diagram]`

<!-- ![Generated MR](images/generated-mr.png) -->
`[Screenshot: Example merge request generated by Skyrchitect with architecture overview and cost estimates]`

<!-- ![Chat Agent](images/chat-agent.png) -->
`[Screenshot: Interactive chat with Skyrchitect agent in GitLab Duo]`

<!-- ![Voice Input](images/voice-input.png) -->
`[Screenshot: Voice input capturing infrastructure requirements via ElevenLabs Scribe]`

### Demo

<!-- ![Demo Video](link-to-demo-video) -->
`[Demo video link: End-to-end walkthrough from issue creation to merge request]`

## Links

- **GitLab Repository**: <!-- Add your GitLab repo URL here -->
- **Submitted to**: GitLab AI Hackathon

## Created by

- **Eimis**

<!-- skyrchitect: monorepo sync marker -->
