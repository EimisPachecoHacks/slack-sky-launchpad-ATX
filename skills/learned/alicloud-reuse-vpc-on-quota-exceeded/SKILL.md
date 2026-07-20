---
name: alicloud-reuse-vpc-on-quota-exceeded
description: >
  Handle Alicloud VPC quota exceeded errors by allowing reuse of an existing VPC.
metadata:
  slash-command: enabled
  learned: true
  error_signature: "QuotaExceeded.Vpc"
---

## Alicloud VPC Quota Exceeded

### Root Cause
The Alibaba Cloud account has reached the maximum allowed number of VPCs in the target region (default quotas are often low, e.g., 10-20 per region). When Terraform attempts to create a new `alicloud_vpc`, the API returns a `400 QuotaExceeded.Vpc` error.

### Fix Pattern
Since quotas cannot be increased dynamically via Terraform, the standard IaC workaround is to make VPC creation conditional. Introduce an `existing_vpc_id` variable. If provided, Terraform skips VPC creation and reuses the existing VPC ID for downstream resources (VSwitches, Security Groups). This allows deployments to proceed in accounts or regions where the VPC quota is exhausted.

### Terraform Example
```hcl
variable "existing_vpc_id" {
  description = "Optional existing VPC ID to reuse. Bypasses VPC quota limits."
  type        = string
  default     = ""
}

resource "alicloud_vpc" "main" {
  count      = var.existing_vpc_id == "" ? 1 : 0
  vpc_name   = "my-vpc"
  cidr_block = "172.16.0.0/16"
}

locals {
  vpc_id = var.existing_vpc_id != "" ? var.existing_vpc_id : alicloud_vpc.main[0].id
}

resource "alicloud_vswitch" "main" {
  vpc_id     = local.vpc_id
  cidr_block = "172.16.0.0/24"
  # ...
}
```
