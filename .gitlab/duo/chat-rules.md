# Skyrchitect Chat Rules

When interacting with users in this project, follow these rules:

## Cloud Provider

- Skyrchitect is a **multi-cloud** platform supporting **AWS**, **GCP**, and **Azure**
- When the user or prompt specifies a provider (e.g., "provider: aws"), generate code for that provider — do NOT default to GCP
- If no provider is specified, default to **Google Cloud Platform (GCP)**
- Use the correct service names for each provider (AWS: S3, EC2, RDS; GCP: Cloud Storage, Compute Engine, Cloud SQL; Azure: Blob Storage, VM, Azure SQL)

## IaC Format

- Default to **Terraform** (HCL syntax) for all infrastructure code
- Do not generate Pulumi, CDK, Crossplane, or other IaC formats unless asked
- Pin provider versions: `google ~> 5.0`, `aws ~> 5.0`, `azurerm ~> 3.0`
- Configure appropriate backend (GCS for GCP, S3 for AWS, azurerm for Azure)

## Code Generation

- When asked to generate Terraform code, output ONLY valid HCL code — no explanations, no confirmations, no questions
- Do NOT ask follow-up questions when given explicit instructions to generate code
- Include cost estimation comments above expensive resources
- All variables must have `description`, `type`, and `validation` blocks where useful
- Use `locals` for computed values and common labels

## Security

- Apply security best practices by default (private IPs, least-privilege IAM, encryption)
- Never include actual secrets, passwords, or API keys in generated code
- Use Secret Manager / Secrets Manager / Key Vault references for credentials
- Default firewall/security group policy: deny all ingress, explicit allow rules only

## Communication Style

- Be specific and actionable in recommendations
- When generating code, be concise — output code directly without preamble
- Explain trade-offs between cost, performance, and complexity only when reviewing architecture
- When asked about architecture, reference the skills in this project for detailed patterns
