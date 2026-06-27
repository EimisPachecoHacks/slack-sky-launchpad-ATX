---
name: terraform-gcp-generator
description: >
  Generate production-ready Terraform configurations for Google Cloud Platform.
  Covers all major GCP services, module structure, remote state, provider configuration,
  and HCL best practices.
metadata:
  slash-command: enabled
---

## Terraform GCP Generator

Generate complete, production-ready Terraform configurations for Google Cloud Platform infrastructure.

### Provider Configuration

Always pin provider versions and configure the project:

```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "BUCKET_NAME-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}
```

### Required Variables Pattern

Every module must define these base variables:

```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Project ID must be 6-30 chars, lowercase letters, digits, hyphens."
  }
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "labels" {
  description = "Common labels for all resources"
  type        = map(string)
  default     = {}
}
```

### Standard Labels

Apply to every resource that supports labels:

```hcl
locals {
  common_labels = merge(var.labels, {
    environment = var.environment
    managed_by  = "skyrchitect"
    terraform   = "true"
  })
}
```

### GCP Service Resource Reference

#### Compute Engine

```hcl
resource "google_compute_instance" "app" {
  name         = "${var.project_id}-app-${var.environment}"
  machine_type = "e2-medium"  # ~$24/mo, cost-effective general purpose
  zone         = "${var.region}-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
      type  = "pd-standard"  # Use pd-ssd only if IOPS needed
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.private.id
    # No access_config = no external IP (use IAP or NAT)
  }

  service_account {
    email  = google_service_account.app.email
    scopes = ["cloud-platform"]
  }

  labels = local.common_labels

  metadata = {
    enable-oslogin = "TRUE"
  }
}
```

#### Cloud SQL (PostgreSQL)

```hcl
resource "google_sql_database_instance" "main" {
  name             = "${var.project_id}-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = "db-custom-2-8192"  # ~$97/mo, 2 vCPU, 8GB RAM
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_type         = "PD_SSD"
    disk_size         = 20
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false  # Private IP only
      private_network = google_compute_network.vpc.id
      ssl_mode        = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
      }
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 3
      update_track = "stable"
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
  }

  deletion_protection = var.environment == "prod"
  labels              = local.common_labels
}
```

#### Cloud Run

```hcl
resource "google_cloud_run_v2_service" "api" {
  name     = "${var.project_id}-api-${var.environment}"
  location = var.region

  template {
    containers {
      image = var.container_image

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name = "DB_CONNECTION"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.db_connection.secret_id
            version = "latest"
          }
        }
      }
    }

    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0
      max_instance_count = 10
    }

    service_account = google_service_account.cloud_run.email

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }
  }

  labels = local.common_labels
}
```

#### VPC Networking

```hcl
resource "google_compute_network" "vpc" {
  name                    = "${var.project_id}-vpc-${var.environment}"
  auto_create_subnetworks = false  # Always use custom subnets
}

resource "google_compute_subnetwork" "private" {
  name                     = "${var.project_id}-private-${var.environment}"
  ip_cidr_range            = "10.0.1.0/24"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true  # Access Google APIs without external IP
}

resource "google_compute_router" "nat_router" {
  name    = "${var.project_id}-nat-router-${var.environment}"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.project_id}-nat-${var.environment}"
  router                             = google_compute_router.nat_router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
```

#### GKE (Google Kubernetes Engine)

```hcl
resource "google_container_cluster" "primary" {
  name     = "${var.project_id}-gke-${var.environment}"
  location = var.region

  remove_default_node_pool = true
  initial_node_count       = 1

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.private.id

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  resource_labels = local.common_labels
}

resource "google_container_node_pool" "primary" {
  name     = "${var.project_id}-nodepool-${var.environment}"
  location = var.region
  cluster  = google_container_cluster.primary.name

  autoscaling {
    min_node_count = 1
    max_node_count = var.environment == "prod" ? 10 : 3
  }

  node_config {
    machine_type    = "e2-standard-4"
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]

    labels = local.common_labels

    workload_metadata_config {
      mode = "GKE_METADATA"
    }
  }
}
```

#### BigQuery

```hcl
resource "google_bigquery_dataset" "main" {
  dataset_id    = replace("${var.project_id}_${var.environment}", "-", "_")
  friendly_name = "${var.project_id} ${var.environment}"
  location      = var.region

  default_table_expiration_ms     = null
  default_partition_expiration_ms = null

  labels = local.common_labels

  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }
}
```

#### Cloud Storage

```hcl
resource "google_storage_bucket" "data" {
  name          = "${var.project_id}-data-${var.environment}"
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  labels = local.common_labels
}
```

### Enable Required APIs

Always enable the GCP APIs before creating resources:

```hcl
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false
}
```

### Outputs Pattern

```hcl
output "vpc_id" {
  description = "VPC network ID"
  value       = google_compute_network.vpc.id
}

output "database_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.main.connection_name
  sensitive   = true
}
```

### Module Composition

For larger projects, split into modules:

```
terraform/
  main.tf           # Root module, calls child modules
  variables.tf      # Root variables
  outputs.tf        # Root outputs
  providers.tf      # Provider and backend config
  modules/
    networking/      # VPC, subnets, firewall, NAT
    compute/         # GCE, MIG, autoscaler
    database/        # Cloud SQL, Memorystore
    storage/         # GCS buckets
    iam/             # Service accounts, IAM bindings
```
