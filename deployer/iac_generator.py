"""Generate Terraform configurations for GCP and AWS."""

import os
from pathlib import Path

COMMON_LABELS = """\
  managed_by  = "skyrchitect"
  environment = var.environment
"""


def generate_gcp_terraform(
    project_id: str,
    region: str = "us-central1",
    environment: str = "dev",
    architecture: str = "minimal-test",
) -> dict[str, str]:
    """Generate a minimal but real GCP Terraform config for deployment testing."""

    providers_tf = f"""\
terraform {{
  required_version = ">= 1.5.0"

  required_providers {{
    google = {{
      source  = "hashicorp/google"
      version = "~> 5.0"
    }}
  }}
}}

provider "google" {{
  project     = var.project_id
  region      = var.region
  credentials = file(var.credentials_file)
}}
"""

    variables_tf = f"""\
variable "project_id" {{
  description = "GCP project ID"
  type        = string
  default     = "{project_id}"
}}

variable "region" {{
  description = "GCP region"
  type        = string
  default     = "{region}"
}}

variable "environment" {{
  description = "Environment name"
  type        = string
  default     = "{environment}"
}}

variable "credentials_file" {{
  description = "Path to GCP service account JSON"
  type        = string
}}
"""

    main_tf = f"""\
locals {{
  labels = {{
    environment = var.environment
    managed_by  = "skyrchitect"
  }}
}}

resource "google_storage_bucket" "skyrchitect_test" {{
  name          = "${{var.project_id}}-skyrchitect-${{var.environment}}"
  location      = var.region
  force_destroy = true

  uniform_bucket_level_access = true

  labels = local.labels

  versioning {{
    enabled = true
  }}

  lifecycle_rule {{
    action {{
      type = "Delete"
    }}
    condition {{
      age = 30
    }}
  }}

}}

resource "google_compute_network" "skyrchitect_vpc" {{
  name                    = "${{var.project_id}}-vpc-${{var.environment}}"
  auto_create_subnetworks = false
  description             = "Skyrchitect managed VPC for ${{var.environment}}"

}}

resource "google_compute_subnetwork" "skyrchitect_subnet" {{
  name          = "${{var.project_id}}-subnet-${{var.environment}}"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.skyrchitect_vpc.id

  private_ip_google_access = true

  log_config {{
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }}
}}

resource "google_compute_firewall" "deny_all_ingress" {{
  name    = "${{var.project_id}}-deny-all-${{var.environment}}"
  network = google_compute_network.skyrchitect_vpc.name

  priority  = 65534
  direction = "INGRESS"

  deny {{
    protocol = "all"
  }}

  source_ranges = ["0.0.0.0/0"]
  description   = "Default deny all ingress - Skyrchitect security baseline"
}}
"""

    outputs_tf = """\
output "bucket_name" {
  description = "Created GCS bucket name"
  value       = google_storage_bucket.skyrchitect_test.name
}

output "bucket_url" {
  description = "Created GCS bucket URL"
  value       = google_storage_bucket.skyrchitect_test.url
}

output "vpc_name" {
  description = "Created VPC name"
  value       = google_compute_network.skyrchitect_vpc.name
}

output "subnet_name" {
  description = "Created subnet name"
  value       = google_compute_subnetwork.skyrchitect_subnet.name
}
"""

    readme_md = f"""\
# Skyrchitect GCP Deployment — {architecture}

**Auto-generated and deployment-validated by Skyrchitect.**

## Resources Created
- GCS Bucket with versioning and lifecycle rules
- Custom VPC with private subnet
- Deny-all default firewall rule

## Project: `{project_id}`
## Region: `{region}`
## Environment: `{environment}`
"""

    return {
        "providers.tf": providers_tf,
        "variables.tf": variables_tf,
        "main.tf": main_tf,
        "outputs.tf": outputs_tf,
        "README.md": readme_md,
    }


def generate_aws_terraform(
    account_id: str,
    region: str = "us-east-1",
    environment: str = "dev",
    architecture: str = "minimal-test",
) -> dict[str, str]:
    """Generate a minimal but real AWS Terraform config for deployment testing."""

    providers_tf = f"""\
terraform {{
  required_version = ">= 1.5.0"

  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region     = var.region
  access_key = var.aws_access_key_id
  secret_key = var.aws_secret_access_key
}}
"""

    variables_tf = f"""\
variable "region" {{
  description = "AWS region"
  type        = string
  default     = "{region}"
}}

variable "environment" {{
  description = "Environment name"
  type        = string
  default     = "{environment}"
}}

variable "aws_access_key_id" {{
  description = "AWS Access Key ID"
  type        = string
  sensitive   = true
}}

variable "aws_secret_access_key" {{
  description = "AWS Secret Access Key"
  type        = string
  sensitive   = true
}}
"""

    main_tf = f"""\
locals {{
  tags = {{
    Environment = var.environment
    ManagedBy   = "skyrchitect"
  }}
}}

resource "aws_s3_bucket" "skyrchitect_test" {{
  bucket        = "skyrchitect-${{var.environment}}-{account_id}"
  force_destroy = true

  tags = local.tags
}}

resource "aws_s3_bucket_versioning" "skyrchitect_test" {{
  bucket = aws_s3_bucket.skyrchitect_test.id
  versioning_configuration {{
    status = "Enabled"
  }}
}}

resource "aws_s3_bucket_server_side_encryption_configuration" "skyrchitect_test" {{
  bucket = aws_s3_bucket.skyrchitect_test.id
  rule {{
    apply_server_side_encryption_by_default {{
      sse_algorithm = "AES256"
    }}
  }}
}}

resource "aws_s3_bucket_public_access_block" "skyrchitect_test" {{
  bucket                  = aws_s3_bucket.skyrchitect_test.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}}

resource "aws_vpc" "skyrchitect_vpc" {{
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.tags, {{
    Name = "skyrchitect-vpc-${{var.environment}}"
  }})
}}

resource "aws_subnet" "skyrchitect_subnet" {{
  vpc_id            = aws_vpc.skyrchitect_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${{var.region}}a"

  tags = merge(local.tags, {{
    Name = "skyrchitect-subnet-${{var.environment}}"
  }})
}}
"""

    outputs_tf = """\
output "bucket_name" {
  description = "Created S3 bucket name"
  value       = aws_s3_bucket.skyrchitect_test.id
}

output "bucket_arn" {
  description = "Created S3 bucket ARN"
  value       = aws_s3_bucket.skyrchitect_test.arn
}

output "vpc_id" {
  description = "Created VPC ID"
  value       = aws_vpc.skyrchitect_vpc.id
}

output "subnet_id" {
  description = "Created subnet ID"
  value       = aws_subnet.skyrchitect_subnet.id
}
"""

    readme_md = f"""\
# Skyrchitect AWS Deployment — {architecture}

**Auto-generated and deployment-validated by Skyrchitect.**

## Resources Created
- S3 Bucket with versioning, encryption, and public access block
- VPC with DNS support
- Private subnet

## Account: `{account_id}`
## Region: `{region}`
## Environment: `{environment}`
"""

    return {
        "providers.tf": providers_tf,
        "variables.tf": variables_tf,
        "main.tf": main_tf,
        "outputs.tf": outputs_tf,
        "README.md": readme_md,
    }


def generate_alicloud_terraform(
    region: str = "ap-southeast-1",
    environment: str = "dev",
    name_prefix: str = "skyrchitect",
    architecture: str = "minimal-test",
) -> dict[str, str]:
    """Generate a minimal but real Alibaba Cloud (alicloud) Terraform config.

    Mirrors the GCP/AWS generators: an OSS bucket + VPC + VSwitch + security
    group — enough to prove an end-to-end apply on Alibaba Cloud. Credentials
    (RAM AccessKey) are passed as -var at apply time by the deployment engine.
    """

    providers_tf = """\
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.220"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "alicloud" {
  access_key = var.access_key
  secret_key = var.secret_key
  region     = var.region
}
"""

    variables_tf = f"""\
variable "access_key" {{
  description = "Alibaba Cloud RAM AccessKey ID"
  type        = string
  sensitive   = true
}}

variable "secret_key" {{
  description = "Alibaba Cloud RAM AccessKey Secret"
  type        = string
  sensitive   = true
}}

variable "region" {{
  description = "Alibaba Cloud region"
  type        = string
  default     = "{region}"
}}

variable "environment" {{
  description = "Environment name"
  type        = string
  default     = "{environment}"
}}

variable "name_prefix" {{
  description = "Prefix for created resource names (OSS names are globally unique)"
  type        = string
  default     = "{name_prefix}"
}}

variable "enable_oss" {{
  description = "Create an OSS bucket. Off by default: OSS must be activated on the account (real-name verification + payment method), so a bare deploy without it succeeds on any account."
  type        = bool
  default     = false
}}
"""

    main_tf = """\
locals {
  tags = {
    environment = var.environment
    managed_by  = "skyrchitect"
  }
}

# Pick a zone in the region that can host a VSwitch.
data "alicloud_zones" "default" {
  available_resource_creation = "VSwitch"
}

# OSS bucket (analogue of GCS/S3). Optional (var.enable_oss, default false):
# OSS must be ACTIVATED on the account, so a bare deploy omits it and always
# succeeds. Names are GLOBALLY unique, so suffix with a short random hash — the
# failure the learned-skill library pre-empts (alicloud-unique-oss-bucket-name).
resource "random_id" "suffix" {
  byte_length = 3
}

resource "alicloud_oss_bucket" "main" {
  count         = var.enable_oss ? 1 : 0
  bucket        = "${var.name_prefix}-${var.environment}-${random_id.suffix.hex}"
  storage_class = "Standard"

  tags = local.tags

  versioning {
    status = "Enabled"
  }

  lifecycle {
    ignore_changes = [lifecycle_rule]
  }
}

resource "alicloud_vpc" "main" {
  vpc_name   = "${var.name_prefix}-vpc-${var.environment}"
  cidr_block = "172.16.0.0/16"
  tags       = local.tags
}

resource "alicloud_vswitch" "main" {
  vswitch_name = "${var.name_prefix}-vsw-${var.environment}"
  vpc_id       = alicloud_vpc.main.id
  cidr_block   = "172.16.0.0/24"
  zone_id      = data.alicloud_zones.default.zones.0.id
  tags         = local.tags
}

# Deny-all-by-default security group (no ingress rules added).
resource "alicloud_security_group" "main" {
  security_group_name = "${var.name_prefix}-sg-${var.environment}"
  vpc_id              = alicloud_vpc.main.id
  tags                = local.tags
}
"""

    # Demo aid (SKY_DEMO_FAULT=1): inject ONE invalid terraform argument so the
    # first apply fails with a real "Unsupported argument" error. The self-
    # healing loop then diagnoses it, authors a learned skill, removes the
    # argument, and retries to success — fail -> learn -> retry -> succeed, end
    # to end. No effect unless the env var is set.
    if os.getenv("SKY_DEMO_FAULT") == "1":
        main_tf = main_tf.replace(
            '  tags                = local.tags\n}',
            '  tags                = local.tags\n  not_a_real_argument = "demo-fault"\n}',
        )

    outputs_tf = """\
output "bucket_name" {
  description = "Created OSS bucket name (empty when OSS is disabled)"
  value       = try(alicloud_oss_bucket.main[0].bucket, "")
}

output "vpc_id" {
  description = "Created VPC id"
  value       = alicloud_vpc.main.id
}

output "vswitch_id" {
  description = "Created VSwitch id"
  value       = alicloud_vswitch.main.id
}

output "security_group_id" {
  description = "Created security group id"
  value       = alicloud_security_group.main.id
}
"""

    readme_md = f"""\
# Skyrchitect Alibaba Cloud Deployment — {architecture}

**Auto-generated and deployment-validated by Skyrchitect.**

## Resources Created
- OSS Bucket with versioning (globally-unique name)
- VPC (172.16.0.0/16)
- VSwitch (172.16.0.0/24) in an available zone
- Deny-all default security group

## Region: `{region}`
## Environment: `{environment}`
"""

    return {
        "providers.tf": providers_tf,
        "variables.tf": variables_tf,
        "main.tf": main_tf,
        "outputs.tf": outputs_tf,
        "README.md": readme_md,
    }
