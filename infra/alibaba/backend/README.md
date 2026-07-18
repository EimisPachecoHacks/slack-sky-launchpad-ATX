# Alibaba Cloud backend proof deployment

This Terraform configuration is the repository evidence required by the Qwen
Cloud hackathon. It provisions the real Sky Launchpad backend/UI on Alibaba
Cloud ECS, using Alibaba OpenAPI calls through the official `aliyun/alicloud`
provider.

Resources:

- pay-as-you-go ECS instance, automatically selecting a small, currently
  available 2-vCPU / 4-GiB type without requiring Billing API access;
- VPC and VSwitch;
- security group exposing only the app port publicly and SSH only to the
  operator's `/32` address;
- ECS key pair and Ubuntu system image;
- pay-by-traffic public bandwidth and economical stopped mode.

No AccessKey is declared in Terraform. Authentication comes from
`ALICLOUD_ACCESS_KEY` and `ALICLOUD_SECRET_KEY`, keeping secrets out of code and
state. The deployment AccessKey stays on the operator machine and is not copied
to the public ECS host. Run `scripts/deploy-alibaba-backend.sh` from the
repository root. Destroy the proof environment with
`scripts/destroy-alibaba-backend.sh` when judging is complete to stop ongoing
compute charges.

The deployment RAM user needs the Alibaba system policies
`AliyunECSFullAccess` and `AliyunVPCFullAccess`. `AliyunOSSFullAccess` is needed
only when the product deploys OSS resources through the generated architecture
workflow; it is not required for this proof host.
