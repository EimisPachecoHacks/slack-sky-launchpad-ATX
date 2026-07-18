terraform {
  required_version = ">= 1.5.0"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.220"
    }
  }
}

# Authentication is intentionally read from ALICLOUD_ACCESS_KEY and
# ALICLOUD_SECRET_KEY. Secrets never enter this configuration or Terraform state.
provider "alicloud" {
  region = var.region
}

locals {
  name = "sky-launchpad-${var.environment}"
  tags = {
    project     = "sky-launchpad"
    environment = var.environment
    managed_by  = "terraform"
    hackathon   = "qwen-cloud-2026"
  }
}

data "alicloud_zones" "backend" {
  available_disk_category     = "cloud_essd"
  available_resource_creation = "Instance"
}

data "alicloud_images" "ubuntu" {
  owners      = "system"
  name_regex  = "^ubuntu_22_04.*64"
  most_recent = true
}

# Choose a small, currently available 2-vCPU / 4-GiB postpaid shape instead of
# hard-coding an instance type that may be sold out in the zone. Price sorting
# is deliberately omitted because it requires the separate Billing OpenAPI.
data "alicloud_instance_types" "backend" {
  availability_zone    = data.alicloud_zones.backend.zones[0].id
  cpu_core_count       = 2
  memory_size          = 4
  instance_charge_type = "PostPaid"
  system_disk_category = "cloud_essd"
}

resource "alicloud_vpc" "backend" {
  vpc_name   = "${local.name}-vpc"
  cidr_block = "172.20.0.0/16"
  tags       = local.tags
}

resource "alicloud_vswitch" "backend" {
  vswitch_name = "${local.name}-vswitch"
  vpc_id       = alicloud_vpc.backend.id
  cidr_block   = "172.20.1.0/24"
  zone_id      = data.alicloud_zones.backend.zones[0].id
  tags         = local.tags
}

resource "alicloud_security_group" "backend" {
  security_group_name = "${local.name}-sg"
  vpc_id              = alicloud_vpc.backend.id
  tags                = local.tags
}

resource "alicloud_security_group_rule" "ssh" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = var.admin_cidr
  description       = "SSH from the deploy operator only"
}

resource "alicloud_security_group_rule" "app" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "8080/8080"
  priority          = 1
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = "0.0.0.0/0"
  description       = "Public Sky Launchpad UI and health proof"
}

resource "alicloud_key_pair" "deployer" {
  key_pair_name = "${local.name}-key"
  public_key    = var.ssh_public_key
  tags          = local.tags
}

resource "alicloud_instance" "backend" {
  availability_zone          = data.alicloud_zones.backend.zones[0].id
  instance_name              = local.name
  host_name                  = "sky-launchpad"
  image_id                   = data.alicloud_images.ubuntu.images[0].id
  instance_type              = data.alicloud_instance_types.backend.instance_types[0].id
  instance_charge_type       = "PostPaid"
  stopped_mode               = "StopCharging"
  security_groups            = [alicloud_security_group.backend.id]
  vswitch_id                 = alicloud_vswitch.backend.id
  system_disk_category       = "cloud_essd"
  system_disk_size           = 20
  internet_charge_type       = "PayByTraffic"
  internet_max_bandwidth_out = 5
  key_name                   = alicloud_key_pair.deployer.key_pair_name
  user_data                  = base64encode(file("${path.module}/cloud-init.sh"))
  tags                       = local.tags
}
