# Sky Launchpad testbed — cheapest possible real infra on Alibaba Cloud.
# One burstable ECS instance (~$0.01-0.02/hr) running the stdlib testbed app on :80.
# Apply/destroy via ../deploy.sh and ../destroy.sh (credentials come from env).

terraform {
  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = ">= 1.220.0"
    }
  }
}

variable "region" {
  default = "ap-southeast-1"
}

provider "alicloud" {
  region = var.region
  # ALICLOUD_ACCESS_KEY / ALICLOUD_SECRET_KEY from env
}

resource "alicloud_vpc" "testbed" {
  vpc_name   = "sky-testbed-vpc"
  cidr_block = "10.10.0.0/16"
}

data "alicloud_zones" "az" {
  available_instance_type = "ecs.t6-c1m1.large"
}

resource "alicloud_vswitch" "testbed" {
  vpc_id     = alicloud_vpc.testbed.id
  cidr_block = "10.10.1.0/24"
  zone_id    = data.alicloud_zones.az.zones[0].id
}

resource "alicloud_security_group" "testbed" {
  security_group_name = "sky-testbed-sg"
  vpc_id              = alicloud_vpc.testbed.id
}

resource "alicloud_security_group_rule" "http" {
  type              = "ingress"
  ip_protocol       = "tcp"
  port_range        = "80/80"
  cidr_ip           = "0.0.0.0/0"
  security_group_id = alicloud_security_group.testbed.id
}

resource "alicloud_instance" "testbed" {
  instance_name              = "sky-testbed"
  instance_type              = "ecs.t6-c1m1.large"
  image_id                   = "ubuntu_22_04_x64_20G_alibase_20240220.vhd"
  vswitch_id                 = alicloud_vswitch.testbed.id
  security_groups            = [alicloud_security_group.testbed.id]
  internet_max_bandwidth_out = 5 # allocates a public IP
  system_disk_category       = "cloud_efficiency"
  system_disk_size           = 20
  instance_charge_type       = "PostPaid"

  user_data = base64encode(<<-EOT
    #!/bin/bash
    mkdir -p /opt/skynotes
    echo '${base64encode(file("${path.module}/../app/app.py"))}' | base64 -d > /opt/skynotes/app.py
    cat > /etc/systemd/system/skynotes.service <<'UNIT'
    [Unit]
    Description=SkyNotes testbed app
    After=network.target
    [Service]
    ExecStart=/usr/bin/python3 /opt/skynotes/app.py 80
    Restart=always
    [Install]
    WantedBy=multi-user.target
    UNIT
    systemctl daemon-reload
    systemctl enable --now skynotes
  EOT
  )
}

output "public_ip" {
  value = alicloud_instance.testbed.public_ip
}

output "url" {
  value = "http://${alicloud_instance.testbed.public_ip}"
}
