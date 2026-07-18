output "instance_id" {
  description = "Alibaba ECS instance ID for console proof"
  value       = alicloud_instance.backend.id
}

output "instance_type" {
  description = "Available 2-vCPU / 4-GiB type selected at apply time"
  value       = alicloud_instance.backend.instance_type
}

output "public_ip" {
  description = "Public IPv4 address assigned by ECS"
  value       = alicloud_instance.backend.public_ip
}

output "application_url" {
  description = "Public Sky Launchpad UI hosted on Alibaba Cloud"
  value       = "http://${alicloud_instance.backend.public_ip}:8080"
}

output "health_url" {
  description = "Public backend health proof"
  value       = "http://${alicloud_instance.backend.public_ip}:8080/health"
}
