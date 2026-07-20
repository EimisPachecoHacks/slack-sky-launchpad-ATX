---
name: alicloud-unsupported-argument
description: >
  Fix unsupported argument errors in Alicloud Terraform resources by removing invalid attributes.
metadata:
  slash-command: enabled
  learned: true
  error_signature: "Unsupported argument.*is not expected here"
---

## Alicloud Unsupported Argument

### Root Cause
An argument was provided to a Terraform resource block that is not supported by the provider schema. This often happens due to typos, using arguments from a different provider, or referencing deprecated/removed attributes.

### Fix Pattern
Identify the unsupported argument from the Terraform error message and remove it from the resource block. Consult the official Terraform provider documentation to verify the correct and currently supported arguments for the specific resource type.

### Terraform Example
```hcl
# Incorrect: includes an unsupported argument
resource "alicloud_security_group" "main" {
  security_group_name = "my-sg"
  vpc_id              = alicloud_vpc.main.id
  not_a_real_argument = "demo-fault"
}

# Correct: unsupported argument removed
resource "alicloud_security_group" "main" {
  security_group_name = "my-sg"
  vpc_id              = alicloud_vpc.main.id
}
```
