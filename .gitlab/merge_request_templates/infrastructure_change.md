## Infrastructure Change

### Architecture Overview

<!-- What GCP services does this MR provision? Describe the architecture briefly. -->



### GCP Services

<!-- List the GCP services included in this Terraform configuration -->

| Service | Purpose | Tier/Size |
|---------|---------|-----------|
|         |         |           |

### Security Measures

- [ ] Service accounts with least-privilege IAM
- [ ] Private IPs for databases and internal services
- [ ] SSL/TLS enforced on all connections
- [ ] Secrets stored in Secret Manager
- [ ] Firewall rules with deny-all default
- [ ] Audit logging enabled
- [ ] Deletion protection on stateful resources (prod)

### Estimated Monthly Cost

| Environment | Estimated Cost |
|-------------|---------------|
| dev         | $              |
| staging     | $              |
| prod        | $              |

### Deployment Instructions

```bash
cd terraform/

# Initialize Terraform with GCS backend
terraform init

# Review the execution plan
terraform plan -var-file=terraform.tfvars

# Apply the changes
terraform apply -var-file=terraform.tfvars
```

### Pre-Merge Checklist

- [ ] `terraform fmt` passes (code is formatted)
- [ ] `terraform validate` passes (syntax is valid)
- [ ] No hardcoded secrets or credentials
- [ ] Variables documented with descriptions
- [ ] README.md explains the architecture
- [ ] Cost estimate is reasonable for the use case
- [ ] State backend is configured (GCS)
- [ ] Provider versions are pinned

### Related Issue

Closes #<!-- issue number -->
