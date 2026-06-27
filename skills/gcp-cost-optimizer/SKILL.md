---
name: gcp-cost-optimizer
description: >
  Optimize Google Cloud Platform infrastructure costs in Terraform configurations.
  Covers pricing models, right-sizing, discount programs, lifecycle management,
  and cost allocation strategies.
metadata:
  slash-command: enabled
---

## GCP Cost Optimizer

Apply cost optimization strategies to GCP Terraform infrastructure without sacrificing reliability.

### GCP Pricing Models

| Model | Best For | Savings |
|-------|----------|---------|
| On-demand | Variable/unpredictable workloads | Baseline |
| Sustained Use Discounts (SUD) | Automatic for consistent usage | Up to 30% |
| Committed Use Discounts (CUD) | Predictable 1-3 year workloads | 37-55% |
| Preemptible / Spot VMs | Fault-tolerant, batch processing | 60-91% |
| Flat-rate pricing | BigQuery heavy analytics | Variable |

### Compute Right-Sizing

#### Machine Type Selection

```hcl
# Development: minimal cost
variable "machine_type" {
  default = "e2-medium"  # ~$24/mo, 2 vCPU, 4GB
}

# Staging: moderate
# e2-standard-2  ~$49/mo, 2 vCPU, 8GB

# Production: performance
# e2-standard-4  ~$97/mo, 4 vCPU, 16GB
# n2-standard-4  ~$116/mo, 4 vCPU, 16GB (better sustained perf)
```

#### Spot/Preemptible VMs for Non-Critical Workloads

```hcl
resource "google_compute_instance" "batch_worker" {
  name         = "${var.project_id}-worker-${var.environment}"
  machine_type = "e2-standard-4"
  zone         = "${var.region}-a"

  scheduling {
    preemptible                 = true  # ~60-91% savings
    automatic_restart           = false
    on_host_maintenance         = "TERMINATE"
    provisioning_model          = "SPOT"
    instance_termination_action = "STOP"
  }

  # ...
}
```

Use for: CI/CD runners, batch processing, data pipelines, dev environments.
Do NOT use for: databases, user-facing services in prod, stateful workloads.

#### Committed Use Discounts

Add as comments for operator action (CUDs are purchased separately, not via Terraform):

```hcl
# COST TIP: This workload runs 24/7 in production.
# Consider a 1-year CUD for e2-standard-4 in us-central1:
#   On-demand: ~$97/mo -> CUD 1yr: ~$61/mo (37% savings)
#   CUD 3yr: ~$44/mo (55% savings)
# Purchase at: https://console.cloud.google.com/compute/commitments
```

### Storage Cost Optimization

#### Cloud Storage Lifecycle Rules

```hcl
resource "google_storage_bucket" "data" {
  name          = "${var.project_id}-data-${var.environment}"
  location      = var.region
  storage_class = "STANDARD"  # $0.020/GB/mo

  lifecycle_rule {
    condition {
      age = 30  # After 30 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"  # $0.010/GB/mo (50% savings)
    }
  }

  lifecycle_rule {
    condition {
      age = 90  # After 90 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"  # $0.004/GB/mo (80% savings)
    }
  }

  lifecycle_rule {
    condition {
      age = 365  # After 1 year
    }
    action {
      type          = "SetStorageClass"
      storage_class = "ARCHIVE"  # $0.0012/GB/mo (94% savings)
    }
  }
}
```

#### Disk Type Selection

| Disk Type | Cost/GB/mo | IOPS | Use Case |
|-----------|-----------|------|----------|
| pd-standard | $0.040 | 0.75/GB | Boot disks, logs, backups |
| pd-balanced | $0.100 | 6/GB | General workloads |
| pd-ssd | $0.170 | 30/GB | Databases, high I/O |
| pd-extreme | $0.125+ | Custom | Mission-critical DBs |

Default to `pd-standard` or `pd-balanced`. Only use `pd-ssd` for databases or proven I/O bottlenecks.

### Database Cost Optimization

#### Cloud SQL Sizing

```hcl
# Development: minimal
# db-f1-micro  ~$7/mo (shared CPU, 0.6GB) - for dev only
# db-custom-1-3840  ~$32/mo (1 vCPU, 3.75GB)

# Staging: moderate
# db-custom-2-8192  ~$97/mo (2 vCPU, 8GB)

# Production: HA with appropriate sizing
# db-custom-4-16384  ~$194/mo (4 vCPU, 16GB)
# Add REGIONAL availability_type for HA (~2x cost but required for prod)
```

#### Environment-Aware Sizing

```hcl
locals {
  db_tier = {
    dev     = "db-f1-micro"
    staging = "db-custom-2-8192"
    prod    = "db-custom-4-16384"
  }

  db_availability = {
    dev     = "ZONAL"
    staging = "ZONAL"
    prod    = "REGIONAL"
  }
}

resource "google_sql_database_instance" "main" {
  # ...
  settings {
    tier              = local.db_tier[var.environment]
    availability_type = local.db_availability[var.environment]
  }
}
```

### Serverless Cost Patterns

#### Cloud Run: Scale to Zero

```hcl
resource "google_cloud_run_v2_service" "api" {
  # ...
  template {
    scaling {
      min_instance_count = var.environment == "prod" ? 1 : 0  # Dev/staging scale to zero
      max_instance_count = 10
    }

    containers {
      resources {
        limits = {
          cpu    = "1000m"   # $0.00002400/vCPU-second
          memory = "512Mi"   # $0.00000250/GiB-second
        }
        cpu_idle = true  # CPU only charged during request processing
      }
    }
  }
}
```

### BigQuery Cost Optimization

- Use **on-demand** pricing for exploration ($6.25/TB scanned)
- Switch to **flat-rate/editions** for heavy, predictable analytics
- Partition tables by date: `time_partitioning { type = "DAY" }`
- Cluster tables on frequently filtered columns
- Set `default_table_expiration_ms` for temporary datasets

### Network Cost Reduction

- Use **Private Google Access** to avoid egress charges to Google APIs
- Keep resources in the **same region** to avoid inter-region egress ($0.01/GB)
- Use **Cloud CDN** for frequently accessed static content
- Use **VPC Flow Logs** sampling (not 100%) to reduce logging costs

### Cost Allocation with Labels

Always apply these labels for cost tracking:

```hcl
locals {
  cost_labels = {
    environment = var.environment
    team        = var.team
    cost_center = var.cost_center
    managed_by  = "skyrchitect"
    project     = var.project_id
  }
}
```

Export labels to BigQuery billing export for analysis.

### Budget Alerts

```hcl
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "${var.project_id}-${var.environment}-budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = var.budget_monthly_usd
    }
  }

  threshold_rules {
    threshold_percent = 0.5   # 50% alert
  }
  threshold_rules {
    threshold_percent = 0.8   # 80% alert
  }
  threshold_rules {
    threshold_percent = 1.0   # 100% alert
  }
}
```

### Cost Estimation Reference

| Service | Dev/mo | Staging/mo | Prod/mo |
|---------|--------|------------|---------|
| e2-medium (1x) | $24 | $24 | - |
| e2-standard-4 (2x) | - | - | $194 |
| Cloud SQL (basic) | $7 | $97 | $388 (HA) |
| Cloud Run (low) | $0-5 | $5-20 | $20-100 |
| GCS 100GB | $2 | $2 | $2 |
| Cloud NAT | $1 | $1 | $1-10 |
| Load Balancer | - | - | $18+ |
| **Typical total** | **~$35** | **~$150** | **~$600+** |
