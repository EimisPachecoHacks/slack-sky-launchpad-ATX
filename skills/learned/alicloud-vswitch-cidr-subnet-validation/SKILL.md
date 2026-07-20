---
name: alicloud-vswitch-cidr-subnet-validation
description: >
  Alicloud VSwitch CIDR block must be a valid subnet of the VPC CIDR block to avoid InvalidParameter errors.
metadata:
  slash-command: enabled
  learned: true
  error_signature: "Specified CIDR block is not valid in VPC"
---

## Alicloud VSwitch CIDR Must Be Subnet of VPC

### Root Cause
When creating an `alicloud_vswitch`, the `cidr_block` attribute must be a valid subnet of the parent `alicloud_vpc`'s `cidr_block`. If the VSwitch CIDR does not fall within the VPC CIDR range (e.g., VPC is `172.16.0.0/16` but VSwitch is `10.99.0.0/24`), the Alicloud API rejects the request with a `400 InvalidParameter` and the message `Specified CIDR block is not valid in VPC.`

### Fix Pattern
Always verify that the `cidr_block` assigned to an `alicloud_vswitch` is a subnet of the `cidr_block` defined in the associated `alicloud_vpc`. Use CIDR math to ensure the VSwitch block is fully contained within the VPC block (e.g., `172.16.0.0/24` is valid within `172.16.0.0/16`).

### Terraform Example
```hcl
resource "alicloud_vpc" "main" {
  vpc_name   = "my-vpc"
  cidr_block = "172.16.0.0/16"
}

resource "alicloud_vswitch" "main" {
  vswitch_name = "my-vswitch"
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "172.16.0.0/24" # Must be a subnet of 172.16.0.0/16
  zone_id      = "ap-southeast-1a"
}
```
