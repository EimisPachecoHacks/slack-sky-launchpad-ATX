variable "project_id" {
  description = "The GCP project ID where resources will be created"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 characters, start with a letter, and contain only lowercase letters, digits, and hyphens."
  }
}

variable "region" {
  description = "The GCP region for resource deployment"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "team" {
  description = "Team responsible for the infrastructure"
  type        = string
  default     = "platform"
}

variable "cost_center" {
  description = "Cost center for billing attribution"
  type        = string
  default     = "engineering"
}

variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "db_tier" {
  description = "Cloud SQL machine tier (e.g. db-custom-2-7680 for 2 vCPU / 7.5 GB RAM)"
  type        = string
  default     = "db-custom-2-7680"
}

variable "db_password" {
  description = "PostgreSQL database password (store in Secret Manager for production)"
  type        = string
  sensitive   = true
}

variable "machine_type" {
  description = "Compute Engine machine type for the web/app tier"
  type        = string
  default     = "e2-medium"
}

variable "min_replicas" {
  description = "Minimum number of instances in the managed instance group"
  type        = number
  default     = 1

  validation {
    condition     = var.min_replicas >= 1 && var.min_replicas <= 10
    error_message = "Minimum replicas must be between 1 and 10."
  }
}

variable "max_replicas" {
  description = "Maximum number of instances in the managed instance group"
  type        = number
  default     = 5

  validation {
    condition     = var.max_replicas >= 1 && var.max_replicas <= 20
    error_message = "Maximum replicas must be between 1 and 20."
  }
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection on stateful resources (recommended for prod)"
  type        = bool
  default     = true
}

variable "redis_memory_size_gb" {
  description = "Memory size in GB for the Memorystore Redis instance"
  type        = number
  default     = 1
}
