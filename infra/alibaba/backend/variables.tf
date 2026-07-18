variable "region" {
  description = "Alibaba Cloud region used for the proof backend"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Short environment name used in resource names and tags"
  type        = string
  default     = "hackathon"
}

variable "admin_cidr" {
  description = "Single operator IPv4 CIDR allowed to use SSH, normally x.x.x.x/32"
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0"
    error_message = "admin_cidr must be a restricted IPv4 CIDR; 0.0.0.0/0 is not allowed."
  }
}

variable "ssh_public_key" {
  description = "Ephemeral public key used only for provisioning the proof instance"
  type        = string
  sensitive   = true
}
