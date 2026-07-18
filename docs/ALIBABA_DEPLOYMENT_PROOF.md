# Alibaba Cloud deployment proof

Sky Launchpad's proof backend is reproducibly provisioned on Alibaba Cloud by
the official `aliyun/alicloud` Terraform provider. The proof configuration is
intentionally public and contains no AccessKey values.

## Repository evidence

- [`infra/alibaba/backend/main.tf`](../infra/alibaba/backend/main.tf) calls the
  Alibaba Cloud ECS and VPC APIs to create the VPC, VSwitch, security group,
  key pair, and pay-as-you-go ECS host.
- [`infra/alibaba/backend/cloud-init.sh`](../infra/alibaba/backend/cloud-init.sh)
  prepares Docker on the ECS host.
- [`scripts/deploy-alibaba-backend.sh`](../scripts/deploy-alibaba-backend.sh)
  applies the Terraform plan, securely transfers the app, builds the container,
  and verifies the public `/health` endpoint.
- [`cloudrun-nginx.conf`](../cloudrun-nginx.conf) serves the React frontend and
  proxies the public health proof to the FastAPI backend.
- The architecture diagram is in [`README.md`](../README.md#architecture).

## Verification record — 2026-07-18

| Check | Result |
|---|---|
| Encrypted RAM AccessKey authentication | Passed |
| `terraform validate` | Passed |
| Live Alibaba Terraform plan | Passed: 7 to add, 0 change, 0 destroy |
| Selected proof host | `ecs.t6-c1m2.large`, 2 vCPU / 4 GiB, 20 GB ESSD |
| Region / zone | `ap-southeast-1` / `ap-southeast-1a` |
| Network exposure | App `8080` public; SSH `22` restricted to operator `/32` |
| Apply | Waiting for RAM policies `AliyunECSFullAccess` and `AliyunVPCFullAccess` |
| Public application URL | Pending successful apply |
| Public `/health` URL | Pending successful apply |

The first apply stopped before creating billable resources. Alibaba returned
`Forbidden.RAM` for `vpc:CreateVpc` and `ecs:ImportKeyPair`; Terraform state
contains only read-only data sources. Once those two system policies are attached
to the deployment RAM user, rerun `scripts/deploy-alibaba-backend.sh` and replace
the pending fields above with the public URLs and ECS instance ID.

## Security and cost controls

- The RAM AccessKey remains encrypted on the operator machine and is never copied
  to the public ECS host.
- Terraform secrets are provided through environment variables, not source or
  state values.
- Public credential-upload and deployment endpoints require production
  authentication.
- ECS uses pay-as-you-go compute, pay-by-traffic networking, and `StopCharging`
  stopped mode.
- Release the proof environment after judging with
  `CONFIRM_ALIBABA_DESTROY=yes ./scripts/destroy-alibaba-backend.sh`.
