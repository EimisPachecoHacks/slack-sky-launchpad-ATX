---
name: terraform-unsupported-argument
description: >
  Fixes Terraform 'Unsupported argument' errors caused by invalid, misspelled, or non-existent attributes in resource blocks.
metadata:
  slash-command: enabled
  learned: true
  error_signature: "Unsupported argument.*is not expected here"
---

## Terraform Unsupported Argument

### Root Cause
The Terraform configuration includes an argument (attribute) within a resource block that is not recognized or supported by the current version of the provider. This typically occurs due to typos, copying arguments from a different provider's resource, or using deprecated/removed attributes.

### Fix Pattern
1. Identify the resource and the unsupported argument from the Terraform error message.
2. Remove the invalid argument from the resource block entirely.
3. Consult the official Terraform provider documentation for the specific resource to verify the correct, supported arguments and their expected types.

### Terraform Example
```hcl
# Incorrect: includes an unsupported argument
resource "alicloud_security_group" "main" {
  security_group_name = "my-sg"
  vpc_id              = alicloud_vpc.main.id
  not_a_real_argument = "demo-fault" # This will cause an error
}

# Correct: unsupported argument removed
resource "alicloud_security_group" "main" {
  security_group_name = "my-sg"
  vpc_id              = alicloud_vpc.main.id
}
```
