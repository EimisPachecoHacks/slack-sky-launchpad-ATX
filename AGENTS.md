# Skyrchitect - Project Context for GitLab Duo

This project provides AI-powered Infrastructure as Code generation for Google Cloud Platform using Terraform. When working in this repository, follow these conventions.

## Project Purpose

Skyrchitect automatically generates production-ready GCP Terraform configurations from GitLab issue descriptions. It creates merge requests with complete infrastructure code including networking, compute, databases, storage, security, and monitoring.

## Terraform Coding Standards

- **Indentation**: 2 spaces (Terraform standard)
- **Naming**: `snake_case` for all resource names, variables, and outputs
- **Resource naming**: Prefix all resource names with `${var.project_id}-<resource>-${var.environment}`
- **Provider versions**: Always pin (`google ~> 5.0`, `google-beta ~> 5.0`)
- **State backend**: GCS bucket, configured in `providers.tf`
- **Variables**: Every variable must have `description`, `type`, and `validation` where applicable
- **Outputs**: Include `description` and mark sensitive values with `sensitive = true`

## Required Labels

All GCP resources that support labels must include:

```hcl
labels = {
  environment = var.environment
  team        = var.team
  cost_center = var.cost_center
  managed_by  = "skyrchitect"
}
```

## Directory Structure

Generated Terraform files are placed under `terraform/` in the repository root:

```
terraform/
  providers.tf          # Provider config, backend, required versions
  main.tf               # Primary resource definitions
  variables.tf          # Input variables with validation
  outputs.tf            # Output values
  terraform.tfvars.example  # Example values (never real secrets)
  README.md             # Module documentation
```

For larger architectures, use child modules:

```
terraform/
  main.tf
  modules/
    networking/
    compute/
    database/
    storage/
    iam/
```

## Security Defaults

- No default compute service accounts; create dedicated SAs per workload
- Databases on private IPs only (no public access)
- SSL/TLS enforced on all connections
- Secrets stored in Secret Manager, never in Terraform variables
- VPC with custom subnets, deny-all default firewall
- `deletion_protection = true` on stateful resources in production

## Environments

- `dev`: Minimal resources, single-zone, lowest cost
- `staging`: Moderate resources, mirrors prod topology
- `prod`: Full HA, multi-zone, monitoring, backups, deletion protection
