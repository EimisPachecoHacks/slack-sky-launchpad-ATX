/**
 * Sky Launchpad — backend on Alibaba Cloud ECS.
 *
 * This is the production home of the Sky Launchpad API (project/backend), the
 * service that calls Qwen models on Qwen Cloud. Required by the hackathon:
 * the backend must demonstrably run on Alibaba Cloud.
 *
 *   terraform init
 *   terraform apply -var="dashscope_api_key=sk-..."
 *   curl http://$(terraform output -raw public_ip):8000/
 */

terraform {
  required_version = ">= 1.3"
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.220"
    }
  }
}

provider "alicloud" {
  region = var.region
}

variable "region" {
  description = "Alibaba Cloud region"
  type        = string
  default     = "ap-southeast-1" # Singapore — international account default
}

variable "name" {
  description = "Resource name prefix"
  type        = string
  default     = "sky-launchpad"
}

variable "ssh_public_key" {
  description = "Public key used for SSH access to the backend instance"
  type        = string
}

# Zones that can actually create instances right now.
data "alicloud_zones" "available" {
  available_resource_creation = "Instance"
}

# A small burstable type is plenty: the box orchestrates Qwen Cloud calls, it
# does not run inference locally.
data "alicloud_instance_types" "small" {
  availability_zone = data.alicloud_zones.available.zones[0].id
  cpu_core_count    = 2
  memory_size       = 4
}

data "alicloud_images" "ubuntu" {
  name_regex  = "^ubuntu_22_04_x64"
  owners      = "system"
  most_recent = true
}

resource "alicloud_vpc" "main" {
  vpc_name   = "${var.name}-vpc"
  cidr_block = "172.16.0.0/16"
}

resource "alicloud_vswitch" "main" {
  vpc_id     = alicloud_vpc.main.id
  cidr_block = "172.16.1.0/24"
  zone_id    = data.alicloud_zones.available.zones[0].id
  vswitch_name = "${var.name}-vsw"
}

resource "alicloud_security_group" "main" {
  name   = "${var.name}-sg"
  vpc_id = alicloud_vpc.main.id
}

# SSH — for deploying and operating the service.
resource "alicloud_security_group_rule" "ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "22/22"
  security_group_id = alicloud_security_group.main.id
  cidr_ip           = "0.0.0.0/0"
}

# The Sky Launchpad API itself. Public so the Slack app (and judges) can reach it.
resource "alicloud_security_group_rule" "api" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "8000/8000"
  security_group_id = alicloud_security_group.main.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_ecs_key_pair" "main" {
  key_pair_name = "${var.name}-key"
  public_key    = var.ssh_public_key
}

resource "alicloud_instance" "backend" {
  instance_name        = "${var.name}-backend"
  host_name            = "${var.name}-backend"
  image_id             = data.alicloud_images.ubuntu.images[0].id
  instance_type        = data.alicloud_instance_types.small.instance_types[0].id
  security_groups      = [alicloud_security_group.main.id]
  vswitch_id           = alicloud_vswitch.main.id
  key_name             = alicloud_ecs_key_pair.main.key_pair_name
  system_disk_category = "cloud_essd"
  system_disk_size     = 40

  # Pay-by-traffic public IP so the API is reachable from Slack and judges.
  internet_charge_type       = "PayByTraffic"
  internet_max_bandwidth_out = 5

  # Prepare the runtime; the application itself is deployed over SSH so the
  # deploy is observable and re-runnable rather than a silent cloud-init.
  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -x
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y python3 python3-pip python3-venv git curl
    mkdir -p /opt/sky-launchpad
    echo "ready" > /opt/sky-launchpad/BOOTSTRAP_OK
  EOF
  )

  tags = {
    Project = "sky-launchpad"
    Purpose = "qwen-cloud-hackathon-backend"
  }
}

output "public_ip" {
  description = "Public IP of the Sky Launchpad backend"
  value       = alicloud_instance.backend.public_ip
}

output "instance_id" {
  value = alicloud_instance.backend.id
}

output "region" {
  value = var.region
}

output "api_url" {
  value = "http://${alicloud_instance.backend.public_ip}:8000"
}
