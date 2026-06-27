# GCP Data Pipeline — Terraform Configuration

Production-ready Google Cloud data pipeline infrastructure provisioned with Terraform. This configuration creates a complete event-driven data pipeline with ingestion, processing, warehousing, and visualization-ready outputs.

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌───────────────┐
│  Data        │    │   Cloud      │    │   Processing    │    │   BigQuery    │
│  Sources     │───▶│   Pub/Sub    │───▶│   (GCS +        │───▶│   Data        │
│  (Events)    │    │   Topic      │    │    Transform)   │    │   Warehouse   │
└─────────────┘    └──────────────┘    └─────────────────┘    └───────┬───────┘
                                              │                       │
                                              ▼                       ▼
                                       ┌─────────────┐       ┌───────────────┐
                                       │  GCS Raw     │       │  Looker /     │
                                       │  Landing     │       │  Data Studio  │
                                       │  Zone        │       │  (Viz Layer)  │
                                       └─────────────┘       └───────────────┘
```

### Pipeline Stages

| Stage | Service | Purpose |
|-------|---------|---------|
| **Ingestion** | Cloud Pub/Sub | Receives events from producers with at-least-once delivery and dead-letter handling |
| **Landing** | Cloud Storage (raw) | Stores raw event data with lifecycle tiering (Standard → Nearline → Coldline) |
| **Processing** | Cloud Storage (processed) | Holds transformed, validated data ready for warehouse loading |
| **Warehouse** | BigQuery | Partitioned and clustered tables for analytical queries |
| **Scheduling** | Cloud Scheduler | Triggers nightly aggregation jobs at 2 AM UTC |
| **Visualization** | Looker / Data Studio | Connects to BigQuery for dashboards and reports (not provisioned) |

## Services Provisioned

- **Cloud Storage** — 2 buckets (raw landing zone + processed) with CMEK encryption and lifecycle rules
- **Cloud Pub/Sub** — Ingestion topic + subscription with dead-letter topic, exactly-once delivery
- **BigQuery** — Dataset with partitioned events table and daily aggregates table
- **Cloud Scheduler** — Nightly aggregation trigger (cron: `0 2 * * *`)
- **Cloud KMS** — Key ring + crypto key for customer-managed encryption (CMEK)
- **IAM** — 3 dedicated service accounts with least-privilege roles
- **Audit Logging** — Data access audit logs enabled for all services

## Prerequisites

1. **GCP Project** with billing enabled
2. **Terraform** >= 1.5.0 installed
3. **gcloud CLI** authenticated with sufficient permissions:
   - `roles/owner` or a custom role covering:
     - `roles/storage.admin`
     - `roles/pubsub.admin`
     - `roles/bigquery.admin`
     - `roles/cloudkms.admin`
     - `roles/iam.serviceAccountAdmin`
     - `roles/cloudscheduler.admin`
     - `roles/serviceusage.serviceUsageAdmin`
4. **GCS bucket** for Terraform remote state (update `providers.tf` backend block)

## Usage

```bash
# 1. Clone and navigate to this directory
cd examples/terraform/gcp-data-pipeline/

# 2. Create your variable values file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project-specific values

# 3. Update the GCS backend bucket in providers.tf
# Replace "REPLACE_WITH_STATE_BUCKET" with your state bucket name

# 4. Initialize Terraform
terraform init

# 5. Review the execution plan
terraform plan

# 6. Apply the configuration
terraform apply

# 7. Verify outputs
terraform output
```

### Tear Down

```bash
# For non-production environments only
terraform destroy
```

> **Warning:** Production environments have `deletion_protection = true` on stateful resources. You must manually disable deletion protection before destroying.

## Cost Estimate

Estimated monthly cost varies by data volume and query patterns:

| Component | Low Usage | Medium Usage | High Usage |
|-----------|-----------|--------------|------------|
| Cloud Storage (raw + processed) | $5 | $50 | $200 |
| Pub/Sub (ingestion throughput) | $2 | $20 | $80 |
| BigQuery (storage + queries) | $10 | $80 | $300 |
| Cloud Scheduler | $0.10 | $0.10 | $0.10 |
| Cloud KMS | $1 | $1 | $5 |
| **Total** | **~$18** | **~$151** | **~$585** |

> **Typical range: $100–$500/mo** depending on data volume (1–50 GB/day ingestion, 1–10 TB/mo queried). Lifecycle rules on Cloud Storage reduce long-term costs by automatically transitioning data to cheaper tiers.

### Cost Optimization Tips

- Use `retention_days` to auto-delete stale data
- Storage lifecycle rules tier objects: Standard (hot) → Nearline (90d) → Coldline (365d)
- BigQuery partitioning + clustering minimize bytes scanned per query
- Use BigQuery reservations (flat-rate) if on-demand query costs exceed $500/mo

## Security Features

| Feature | Implementation |
|---------|---------------|
| **CMEK Encryption** | Cloud KMS key encrypts GCS buckets, Pub/Sub topics, and BigQuery dataset at rest |
| **Least-Privilege IAM** | 3 dedicated service accounts with minimal roles (no default compute SA) |
| **Audit Logging** | Admin read, data read, and data write audit logs enabled for all services |
| **No Public Access** | Uniform bucket-level access on GCS; no public BigQuery access |
| **Dead-Letter Queue** | Failed messages routed to a dead-letter topic for inspection |
| **Deletion Protection** | Enabled on production BigQuery tables to prevent accidental data loss |
| **Key Rotation** | KMS key rotates automatically every 90 days |
| **Versioning** | GCS bucket versioning enabled for recovery from accidental overwrites |

## File Structure

```
gcp-data-pipeline/
├── providers.tf              # Provider config, backend, required versions
├── main.tf                   # All resource definitions
├── variables.tf              # Input variables with validation
├── outputs.tf                # Output values
├── terraform.tfvars.example  # Example variable values (copy to terraform.tfvars)
└── README.md                 # This file
```

## Variables Reference

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `project_id` | `string` | — | GCP project ID (required) |
| `region` | `string` | `us-central1` | GCP region |
| `environment` | `string` | — | `dev`, `staging`, or `prod` (required) |
| `team` | `string` | `data-engineering` | Team label |
| `cost_center` | `string` | `data-platform` | Cost center label |
| `labels` | `map(string)` | `{}` | Additional resource labels |
| `retention_days` | `number` | `0` | Data retention (0 = no expiration) |
| `bigquery_dataset_id` | `string` | `data_pipeline_warehouse` | BigQuery dataset ID |
| `pubsub_message_retention` | `string` | `604800s` | Pub/Sub retention (max 7 days) |
| `scheduler_timezone` | `string` | `Etc/UTC` | Scheduler timezone |
| `deletion_protection` | `bool` | `true` | Protect stateful resources |
