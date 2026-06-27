locals {
  resource_prefix = "${var.project_id}-datapipeline-${var.environment}"

  default_labels = merge(
    {
      environment = var.environment
      team        = var.team
      cost_center = var.cost_center
      managed_by  = "skyrchitect"
    },
    var.labels,
  )

  is_prod = var.environment == "prod"
}

# -----------------------------------------------------------------------------
# Enable Required APIs (~$0/mo — API enablement is free)
# -----------------------------------------------------------------------------

resource "google_project_service" "required_apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "cloudkms.googleapis.com",
    "cloudscheduler.googleapis.com",
    "iam.googleapis.com",
    "pubsub.googleapis.com",
    "storage.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Cloud KMS — Customer-Managed Encryption Keys (~$0.06/key version/mo + $0.03/10k ops)
# -----------------------------------------------------------------------------

resource "google_kms_key_ring" "data_pipeline" {
  name     = "${local.resource_prefix}-keyring"
  location = var.region
  project  = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_kms_crypto_key" "data_pipeline" {
  name     = "${local.resource_prefix}-key"
  key_ring = google_kms_key_ring.data_pipeline.id
  purpose  = "ENCRYPT_DECRYPT"

  rotation_period = "7776000s" # 90 days

  labels = local.default_labels

  lifecycle {
    prevent_destroy = false
  }
}

# Grant the GCS service agent permission to use the CMEK key
data "google_storage_project_service_account" "gcs_sa" {
  project = var.project_id
}

resource "google_kms_crypto_key_iam_member" "gcs_cmek" {
  crypto_key_id = google_kms_crypto_key.data_pipeline.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:${data.google_storage_project_service_account.gcs_sa.email_address}"
}

# Grant the BigQuery service agent permission to use the CMEK key
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_kms_crypto_key_iam_member" "bq_cmek" {
  crypto_key_id = google_kms_crypto_key.data_pipeline.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = "serviceAccount:bq-${data.google_project.current.number}@bigquery-encryption.iam.gserviceaccount.com"
}

# -----------------------------------------------------------------------------
# Service Accounts — Least Privilege (~$0/mo)
# -----------------------------------------------------------------------------

resource "google_service_account" "data_ingestion" {
  account_id   = "${var.project_id}-ingest-sa"
  display_name = "Data Pipeline Ingestion SA"
  description  = "Service account for data ingestion into raw landing zone"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "data_processing" {
  account_id   = "${var.project_id}-process-sa"
  display_name = "Data Pipeline Processing SA"
  description  = "Service account for data transformation and loading"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "scheduler" {
  account_id   = "${var.project_id}-sched-sa"
  display_name = "Data Pipeline Scheduler SA"
  description  = "Service account for Cloud Scheduler job execution"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

# --- Ingestion SA permissions ---

resource "google_project_iam_member" "ingestion_storage_writer" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}

resource "google_project_iam_member" "ingestion_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.data_ingestion.email}"
}

# --- Processing SA permissions ---

resource "google_project_iam_member" "processing_storage_reader" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  member  = "serviceAccount:${google_service_account.data_processing.email}"
}

resource "google_project_iam_member" "processing_storage_writer" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  member  = "serviceAccount:${google_service_account.data_processing.email}"
}

resource "google_project_iam_member" "processing_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.data_processing.email}"
}

resource "google_project_iam_member" "processing_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.data_processing.email}"
}

resource "google_project_iam_member" "processing_pubsub_subscriber" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.data_processing.email}"
}

# --- Scheduler SA permissions ---

resource "google_project_iam_member" "scheduler_invoker" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.scheduler.email}"
}

# -----------------------------------------------------------------------------
# Cloud Storage — Raw Landing Zone (~$0.020/GB/mo standard, lifecycle reduces costs)
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "raw_landing_zone" {
  name          = "${local.resource_prefix}-raw-landing"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  force_destroy               = !local.is_prod

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.data_pipeline.id
  }

  # Standard -> Nearline after 90 days (~$0.010/GB/mo)
  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 90
    }
  }

  # Nearline -> Coldline after 365 days (~$0.004/GB/mo)
  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
    condition {
      age = 365
    }
  }

  # Delete objects older than retention_days if set
  dynamic "lifecycle_rule" {
    for_each = var.retention_days > 0 ? [1] : []
    content {
      action {
        type = "Delete"
      }
      condition {
        age = var.retention_days
      }
    }
  }

  # Delete noncurrent versions after 30 days
  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
  }

  labels = local.default_labels

  depends_on = [
    google_project_service.required_apis,
    google_kms_crypto_key_iam_member.gcs_cmek,
  ]
}

# -----------------------------------------------------------------------------
# Cloud Storage — Processed Data Bucket (~$0.020/GB/mo standard)
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "processed" {
  name          = "${local.resource_prefix}-processed"
  location      = var.region
  project       = var.project_id
  storage_class = "STANDARD"

  uniform_bucket_level_access = true
  force_destroy               = !local.is_prod

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.data_pipeline.id
  }

  # Archive processed data after 180 days
  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 180
    }
  }

  dynamic "lifecycle_rule" {
    for_each = var.retention_days > 0 ? [1] : []
    content {
      action {
        type = "Delete"
      }
      condition {
        age = var.retention_days
      }
    }
  }

  labels = local.default_labels

  depends_on = [
    google_project_service.required_apis,
    google_kms_crypto_key_iam_member.gcs_cmek,
  ]
}

# -----------------------------------------------------------------------------
# Pub/Sub — Event Ingestion (~$40/TB ingested)
# -----------------------------------------------------------------------------

resource "google_pubsub_topic" "data_ingestion" {
  name    = "${local.resource_prefix}-ingestion-topic"
  project = var.project_id

  kms_key_name = google_kms_crypto_key.data_pipeline.id

  message_retention_duration = var.pubsub_message_retention

  labels = local.default_labels

  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_subscription" "data_ingestion" {
  name    = "${local.resource_prefix}-ingestion-sub"
  project = var.project_id
  topic   = google_pubsub_topic.data_ingestion.id

  ack_deadline_seconds       = 60
  message_retention_duration = var.pubsub_message_retention
  retain_acked_messages      = false

  expiration_policy {
    ttl = "" # Never expires
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  enable_exactly_once_delivery = true

  labels = local.default_labels
}

# Dead-letter topic for failed messages
resource "google_pubsub_topic" "dead_letter" {
  name    = "${local.resource_prefix}-dead-letter-topic"
  project = var.project_id

  kms_key_name = google_kms_crypto_key.data_pipeline.id

  labels = local.default_labels

  depends_on = [google_project_service.required_apis]
}

resource "google_pubsub_subscription" "dead_letter" {
  name    = "${local.resource_prefix}-dead-letter-sub"
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.id

  ack_deadline_seconds       = 60
  message_retention_duration = "604800s"

  expiration_policy {
    ttl = "" # Never expires
  }

  labels = local.default_labels
}

# -----------------------------------------------------------------------------
# BigQuery — Data Warehouse (~$5/TB queried on-demand, $0.02/GB/mo storage)
# -----------------------------------------------------------------------------

resource "google_bigquery_dataset" "data_warehouse" {
  dataset_id    = var.bigquery_dataset_id
  friendly_name = "Data Pipeline Warehouse"
  description   = "Central data warehouse for the ${var.environment} data pipeline"
  project       = var.project_id
  location      = var.region

  default_table_expiration_ms     = var.retention_days > 0 ? var.retention_days * 86400000 : null
  default_partition_expiration_ms = var.retention_days > 0 ? var.retention_days * 86400000 : null

  delete_contents_on_destroy = !local.is_prod

  default_encryption_configuration {
    kms_key_name = google_kms_crypto_key.data_pipeline.id
  }

  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "WRITER"
    user_by_email = google_service_account.data_processing.email
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  labels = local.default_labels

  depends_on = [
    google_project_service.required_apis,
    google_kms_crypto_key_iam_member.bq_cmek,
  ]
}

resource "google_bigquery_table" "events" {
  dataset_id          = google_bigquery_dataset.data_warehouse.dataset_id
  table_id            = "events"
  project             = var.project_id
  description         = "Raw event data partitioned by ingestion date, clustered by event_type"
  deletion_protection = local.is_prod

  time_partitioning {
    type                     = "DAY"
    field                    = "event_timestamp"
    expiration_ms            = var.retention_days > 0 ? var.retention_days * 86400000 : null
    require_partition_filter = true
  }

  clustering = ["event_type"]

  schema = jsonencode([
    {
      name        = "event_id"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Unique identifier for the event"
    },
    {
      name        = "event_type"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Category of the event (e.g. page_view, purchase, signup)"
    },
    {
      name        = "event_timestamp"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "UTC timestamp when the event occurred"
    },
    {
      name        = "user_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Identifier of the user who triggered the event"
    },
    {
      name        = "session_id"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Session identifier for grouping related events"
    },
    {
      name        = "payload"
      type        = "JSON"
      mode        = "NULLABLE"
      description = "Arbitrary event payload as JSON"
    },
    {
      name        = "source"
      type        = "STRING"
      mode        = "NULLABLE"
      description = "Origin system that produced the event"
    },
    {
      name        = "ingested_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "UTC timestamp when the event was ingested into the pipeline"
    },
  ])

  labels = local.default_labels
}

resource "google_bigquery_table" "daily_aggregates" {
  dataset_id          = google_bigquery_dataset.data_warehouse.dataset_id
  table_id            = "daily_aggregates"
  project             = var.project_id
  description         = "Nightly aggregated event metrics partitioned by date"
  deletion_protection = local.is_prod

  time_partitioning {
    type                     = "DAY"
    field                    = "aggregation_date"
    expiration_ms            = var.retention_days > 0 ? var.retention_days * 86400000 : null
    require_partition_filter = true
  }

  clustering = ["event_type"]

  schema = jsonencode([
    {
      name        = "aggregation_date"
      type        = "DATE"
      mode        = "REQUIRED"
      description = "Date for which metrics are aggregated"
    },
    {
      name        = "event_type"
      type        = "STRING"
      mode        = "REQUIRED"
      description = "Event category being aggregated"
    },
    {
      name        = "event_count"
      type        = "INT64"
      mode        = "REQUIRED"
      description = "Total number of events for this type and date"
    },
    {
      name        = "unique_users"
      type        = "INT64"
      mode        = "NULLABLE"
      description = "Count of distinct users for this event type and date"
    },
    {
      name        = "computed_at"
      type        = "TIMESTAMP"
      mode        = "REQUIRED"
      description = "UTC timestamp when the aggregation was computed"
    },
  ])

  labels = local.default_labels
}

# -----------------------------------------------------------------------------
# Cloud Scheduler — Nightly Aggregation Trigger (~$0.10/job/mo)
# -----------------------------------------------------------------------------

resource "google_cloud_scheduler_job" "nightly_aggregation" {
  name        = "${local.resource_prefix}-nightly-aggregation"
  description = "Triggers nightly data aggregation at 2 AM UTC"
  project     = var.project_id
  region      = var.region
  schedule    = "0 2 * * *"
  time_zone   = var.scheduler_timezone

  retry_config {
    retry_count          = 3
    min_backoff_duration = "5s"
    max_backoff_duration = "3600s"
    max_doublings        = 5
  }

  pubsub_target {
    topic_name = google_pubsub_topic.data_ingestion.id
    data       = base64encode(jsonencode({ action = "nightly_aggregation", triggered_by = "cloud_scheduler" }))
    attributes = {
      trigger_type = "scheduled"
      environment  = var.environment
    }
  }

  depends_on = [google_project_service.required_apis]
}

# -----------------------------------------------------------------------------
# Audit Logging — Data Access Logs for Pipeline Resources
# -----------------------------------------------------------------------------

resource "google_project_iam_audit_config" "data_pipeline_audit" {
  project = var.project_id
  service = "allServices"

  audit_log_config {
    log_type = "ADMIN_READ"
  }

  audit_log_config {
    log_type = "DATA_READ"
  }

  audit_log_config {
    log_type = "DATA_WRITE"
  }
}
