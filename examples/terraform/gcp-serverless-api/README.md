# GCP Serverless API — Terraform Example

Production-ready serverless API infrastructure on Google Cloud Platform. This configuration provisions a fully managed, event-driven API backend that scales to zero in non-production environments.

## Architecture

```
                    ┌──────────────┐
  Internet ────────►│  Cloud Run   │──────► Firestore
                    │   v2 API     │         (Native)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌─────────┐ ┌─────────┐ ┌──────────┐
         │ Pub/Sub │ │ Cloud   │ │ Secret   │
         │  Topic  │ │ Tasks   │ │ Manager  │
         └────┬────┘ └─────────┘ └──────────┘
              │
              ▼
     ┌──────────────────┐
     │ Cloud Functions   │
     │ v2 (event proc.) │──────► Firestore
     └──────────────────┘
```

**Request flow:** Clients hit the Cloud Run API, which reads/writes Firestore, publishes events to Pub/Sub, and enqueues background work via Cloud Tasks. Cloud Functions v2 processes Pub/Sub events asynchronously, writing results back to Firestore.

All serverless workloads connect to the VPC through a Serverless VPC Access connector for private network communication.

## Services Provisioned

| Service | Resource | Purpose |
|---------|----------|---------|
| Cloud Run v2 | `google_cloud_run_v2_service` | API service (scale-to-zero in dev/staging) |
| Firestore | `google_firestore_database` | Document database (Native mode) |
| Pub/Sub | `google_pubsub_topic` + subscription | Event bus with dead-letter routing |
| Cloud Tasks | `google_cloud_tasks_queue` | Background task queue with retry |
| Cloud Functions v2 | `google_cloudfunctions2_function` | Async event processing from Pub/Sub |
| Secret Manager | `google_secret_manager_secret` x2 | API key and webhook secret storage |
| VPC | Network + subnet + connector | Private networking for serverless |
| IAM | Service accounts + bindings | Least-privilege access per workload |

## Prerequisites

1. **GCP project** with billing enabled
2. **Terraform** >= 1.5.0 installed
3. **gcloud CLI** authenticated with appropriate permissions:
   ```bash
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```
4. **Roles required** on the deploying identity:
   - `roles/editor` or individual roles for each service
   - `roles/iam.serviceAccountAdmin` (to create service accounts)
   - `roles/resourcemanager.projectIamAdmin` (to bind IAM roles)
5. **Cloud Functions source:** Upload your function source archive to the GCS bucket before applying:
   ```bash
   gsutil cp function-source.zip gs://YOUR_PROJECT_ID-gcf-source-ENV/event-processor/function-source.zip
   ```

## Usage

### 1. Configure Backend

Create a GCS bucket for Terraform state:

```bash
gsutil mb -l us-central1 gs://YOUR_PROJECT_ID-terraform-state
gsutil versioning set on gs://YOUR_PROJECT_ID-terraform-state
```

### 2. Set Variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project-specific values
```

### 3. Deploy

```bash
# Initialize with backend configuration
terraform init -backend-config="bucket=YOUR_PROJECT_ID-terraform-state" \
               -backend-config="prefix=serverless-api/dev"

# Review the execution plan
terraform plan

# Apply the configuration
terraform apply
```

### 4. Verify

```bash
# Get the Cloud Run URL
terraform output cloud_run_url

# Test the API
curl "$(terraform output -raw cloud_run_url)/health"
```

### Multi-Environment Deployment

Use workspaces or separate backend prefixes per environment:

```bash
# Dev
terraform init -backend-config="prefix=serverless-api/dev"
terraform apply -var="environment=dev"

# Staging
terraform init -backend-config="prefix=serverless-api/staging" -reconfigure
terraform apply -var="environment=staging"

# Prod
terraform init -backend-config="prefix=serverless-api/prod" -reconfigure
terraform apply -var="environment=prod" -var="min_instances=2" -var="max_instances=50"
```

## Cost Estimation

| Component | Dev (idle) | Dev (light) | Prod (moderate) |
|-----------|-----------|-------------|-----------------|
| Cloud Run v2 | $0.00 | $2–8 | $10–30 |
| VPC Connector (2x e2-micro) | $6.91 | $6.91 | $6.91 |
| Firestore | $0.00 | $0.00 | $5–15 |
| Pub/Sub | $0.00 | $0.00 | $1–5 |
| Cloud Tasks | $0.00 | $0.00 | $0.00 |
| Cloud Functions v2 | $0.00 | $0.50 | $2–5 |
| Secret Manager | $0.12 | $0.12 | $0.12 |
| **Total** | **~$7/mo** | **~$10–16/mo** | **~$25–52/mo** |

> The VPC connector is the main fixed cost. In dev, most services operate within free-tier limits. Cloud Run and Cloud Functions scale to zero when idle.

## Security Features

- **No default service accounts** — Dedicated SAs with least-privilege IAM for each workload
- **Private networking** — Custom VPC with Serverless VPC Access connector; deny-all ingress firewall
- **Secret management** — Secrets in Secret Manager with per-secret IAM (never in environment variables)
- **Deletion protection** — Enabled on Cloud Run and Firestore in production
- **Dead-letter routing** — Failed Pub/Sub messages routed to a DLQ topic for investigation
- **Internal-only Cloud Functions** — Event processor restricts ingress to internal traffic only
- **VPC egress control** — Serverless workloads route only private-range traffic through the VPC

## File Structure

```
gcp-serverless-api/
├── providers.tf              # Provider versions, GCS backend
├── main.tf                   # All resource definitions
├── variables.tf              # Input variables with validation
├── outputs.tf                # Key resource outputs
├── terraform.tfvars.example  # Example variable values
└── README.md                 # This file
```

## Cleanup

```bash
# For dev/staging (no deletion protection)
terraform destroy

# For prod: first disable deletion protection
terraform apply -var="environment=prod" -target=google_cloud_run_v2_service.api -var="deletion_protection=false"
terraform destroy -var="environment=prod"
```
