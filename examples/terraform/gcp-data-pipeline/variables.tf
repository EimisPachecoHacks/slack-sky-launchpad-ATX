variable "project_id" {
  description = "GCP project ID where data pipeline resources will be provisioned"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 characters, start with a letter, end with a letter or digit, and contain only lowercase letters, digits, and hyphens."
  }
}

variable "region" {
  description = "GCP region for resource deployment"
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
  description = "Team responsible for this infrastructure"
  type        = string
  default     = "data-engineering"
}

variable "cost_center" {
  description = "Cost center for billing attribution"
  type        = string
  default     = "data-platform"
}

variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "retention_days" {
  description = "Number of days to retain data in BigQuery and Cloud Storage before expiration (0 = no expiration)"
  type        = number
  default     = 0

  validation {
    condition     = var.retention_days >= 0 && var.retention_days <= 3650
    error_message = "Retention days must be between 0 and 3650."
  }
}

variable "bigquery_dataset_id" {
  description = "BigQuery dataset identifier for the data warehouse"
  type        = string
  default     = "data_pipeline_warehouse"

  validation {
    condition     = can(regex("^[a-zA-Z_][a-zA-Z0-9_]{0,1023}$", var.bigquery_dataset_id))
    error_message = "Dataset ID must start with a letter or underscore, contain only letters, digits, and underscores, and be at most 1024 characters."
  }
}

variable "pubsub_message_retention" {
  description = "Duration to retain unacknowledged Pub/Sub messages (e.g. 604800s for 7 days)"
  type        = string
  default     = "604800s"
}

variable "scheduler_timezone" {
  description = "Timezone for Cloud Scheduler jobs"
  type        = string
  default     = "Etc/UTC"
}

variable "deletion_protection" {
  description = "Enable deletion protection on stateful resources (always true in prod)"
  type        = bool
  default     = true
}
