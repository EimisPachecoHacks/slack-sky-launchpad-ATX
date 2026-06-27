# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
# GCP Serverless API Infrastructure
# Provisions Cloud Run v2, Firestore, Pub/Sub, Cloud Tasks, Cloud Functions v2,
# Secret Manager, and supporting networking/IAM resources.
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

locals {
  labels = merge(var.labels, {
    environment = var.environment
    managed_by  = "skyrchitect"
  })

  # Truncate project ID for service account names (30-char limit on account_id)
  sa_prefix = substr(var.project_id, 0, min(length(var.project_id), 18))
}

data "google_project" "current" {
  project_id = var.project_id
}

# ---------------------------------------------------------------------------
# API Enablement
# Cost: Free
# ---------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "cloudtasks.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
    "eventarc.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

# ---------------------------------------------------------------------------
# Service Accounts (least-privilege, no default compute SA)
# Cost: Free
# ---------------------------------------------------------------------------

resource "google_service_account" "cloud_run" {
  account_id   = "${local.sa_prefix}-run-${var.environment}"
  display_name = "Cloud Run API Service Account (${var.environment})"
  project      = var.project_id

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

resource "google_service_account" "cloud_functions" {
  account_id   = "${local.sa_prefix}-gcf-${var.environment}"
  display_name = "Cloud Functions Event Processor SA (${var.environment})"
  project      = var.project_id

  depends_on = [google_project_service.apis["cloudfunctions.googleapis.com"]]
}

# ---------------------------------------------------------------------------
# IAM - Cloud Run Service Account
# ---------------------------------------------------------------------------

resource "google_project_iam_member" "run_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "run_pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_project_iam_member" "run_tasks_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ---------------------------------------------------------------------------
# IAM - Cloud Functions Service Account
# ---------------------------------------------------------------------------

resource "google_project_iam_member" "gcf_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

resource "google_project_iam_member" "gcf_eventarc_receiver" {
  project = var.project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

resource "google_project_iam_member" "gcf_run_invoker" {
  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.cloud_functions.email}"
}

# Pub/Sub service agent needs token creator for authenticated push delivery
resource "google_project_iam_member" "pubsub_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# ---------------------------------------------------------------------------
# Networking
# Cost: VPC connector ~$6.91/mo (2x e2-micro instances, always running)
# ---------------------------------------------------------------------------

resource "google_compute_network" "main" {
  name                    = "${var.project_id}-vpc-${var.environment}"
  project                 = var.project_id
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis["compute.googleapis.com"]]
}

resource "google_compute_subnetwork" "main" {
  name                     = "${var.project_id}-subnet-${var.environment}"
  project                  = var.project_id
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = "10.0.0.0/24"
  private_ip_google_access = true
}

resource "google_vpc_access_connector" "main" {
  name          = "vpc-${var.environment}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.8.0.0/28"
  min_instances = 2
  max_instances = 3
  machine_type  = "e2-micro"

  depends_on = [google_project_service.apis["vpcaccess.googleapis.com"]]
}

# Deny-all default firewall (VPC security baseline)
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.project_id}-deny-ingress-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  direction = "INGRESS"
  priority  = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

# ---------------------------------------------------------------------------
# Cloud Run v2 Service
# Cost: Scale-to-zero in dev/staging ($0 when idle); ~$5-20/mo with traffic
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.project_id}-api-${var.environment}"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.environment == "prod" ? var.min_instances : 0
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.main.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.container_image

      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "FIRESTORE_DATABASE"
        value = google_firestore_database.main.name
      }

      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.main.name
      }

      env {
        name  = "CLOUD_TASKS_QUEUE"
        value = google_cloud_tasks_queue.main.name
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 0
        period_seconds        = 3
        failure_threshold     = 3
        timeout_seconds       = 1
      }
    }
  }

  labels = local.labels

  depends_on = [google_project_service.apis["run.googleapis.com"]]
}

# Allow unauthenticated access (public API); remove for internal-only APIs
resource "google_cloud_run_v2_service_iam_member" "public_access" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------------
# Firestore (Native Mode)
# Cost: Free tier covers 1 GiB storage + 50K reads/20K writes per day
# ---------------------------------------------------------------------------

resource "google_firestore_database" "main" {
  name                        = "${var.environment}-database"
  project                     = var.project_id
  location_id                 = var.region
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  delete_protection_state = var.environment == "prod" ? "DELETE_PROTECTION_ENABLED" : "DELETE_PROTECTION_DISABLED"

  depends_on = [google_project_service.apis["firestore.googleapis.com"]]
}

# ---------------------------------------------------------------------------
# Pub/Sub (event bus with dead-letter routing)
# Cost: Free tier covers 10 GiB/mo
# ---------------------------------------------------------------------------

resource "google_pubsub_topic" "main" {
  name    = "${var.project_id}-events-${var.environment}"
  project = var.project_id
  labels  = local.labels

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

resource "google_pubsub_topic" "dead_letter" {
  name    = "${var.project_id}-events-dlq-${var.environment}"
  project = var.project_id
  labels  = local.labels

  depends_on = [google_project_service.apis["pubsub.googleapis.com"]]
}

resource "google_pubsub_subscription" "main" {
  name    = "${var.project_id}-events-sub-${var.environment}"
  project = var.project_id
  topic   = google_pubsub_topic.main.id
  labels  = local.labels

  ack_deadline_seconds       = 20
  message_retention_duration = "604800s"
  retain_acked_messages      = false

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  expiration_policy {
    ttl = ""
  }
}

# Pub/Sub service agent permissions for dead-letter routing
resource "google_pubsub_topic_iam_member" "dlq_publisher" {
  project = var.project_id
  topic   = google_pubsub_topic.dead_letter.name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription_iam_member" "dlq_subscriber" {
  project      = var.project_id
  subscription = google_pubsub_subscription.main.name
  role         = "roles/pubsub.subscriber"
  member       = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# ---------------------------------------------------------------------------
# Cloud Tasks
# Cost: Free tier covers 1M operations/mo
# ---------------------------------------------------------------------------

resource "google_cloud_tasks_queue" "main" {
  name     = "${var.project_id}-tasks-${var.environment}"
  project  = var.project_id
  location = var.region

  rate_limits {
    max_dispatches_per_second = var.environment == "prod" ? 500 : 100
    max_concurrent_dispatches = var.environment == "prod" ? 100 : 10
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "1s"
    max_backoff        = "300s"
    max_doublings      = 4
    max_retry_duration = "3600s"
  }

  depends_on = [google_project_service.apis["cloudtasks.googleapis.com"]]
}

# ---------------------------------------------------------------------------
# Secret Manager
# Cost: ~$0.06/secret/mo + $0.03 per 10K access operations
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret" "api_key" {
  secret_id = "${var.project_id}-api-key-${var.environment}"
  project   = var.project_id
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "webhook_secret" {
  secret_id = "${var.project_id}-webhook-secret-${var.environment}"
  project   = var.project_id
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# Grant Cloud Run SA read access to secrets
resource "google_secret_manager_secret_iam_member" "run_api_key_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

resource "google_secret_manager_secret_iam_member" "run_webhook_secret_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.webhook_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

# ---------------------------------------------------------------------------
# Cloud Storage (Cloud Functions source bucket)
# Cost: ~$0.02/GB/mo (Standard)
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "functions_source" {
  name     = "${var.project_id}-gcf-source-${var.environment}"
  project  = var.project_id
  location = var.region
  labels   = local.labels

  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = true
  }
}

# ---------------------------------------------------------------------------
# Cloud Functions v2 (async event processor, triggered by Pub/Sub)
# Cost: Free tier covers 2M invocations/mo; ~$0.40 per million after
# Upload function source to gs://<bucket>/event-processor/function-source.zip
# before applying.
# ---------------------------------------------------------------------------

resource "google_cloudfunctions2_function" "event_processor" {
  name     = "${var.project_id}-event-processor-${var.environment}"
  project  = var.project_id
  location = var.region
  labels   = local.labels

  build_config {
    runtime     = "python311"
    entry_point = "process_event"

    source {
      storage_source {
        bucket = google_storage_bucket.functions_source.name
        object = "event-processor/function-source.zip"
      }
    }
  }

  service_config {
    min_instance_count             = 0
    max_instance_count             = var.environment == "prod" ? 10 : 2
    available_memory               = "256M"
    timeout_seconds                = 60
    service_account_email          = google_service_account.cloud_functions.email
    vpc_connector                  = google_vpc_access_connector.main.id
    vpc_connector_egress_settings  = "PRIVATE_RANGES_ONLY"
    ingress_settings               = "ALLOW_INTERNAL_ONLY"
    all_traffic_on_latest_revision = true

    environment_variables = {
      PROJECT_ID         = var.project_id
      ENVIRONMENT        = var.environment
      FIRESTORE_DATABASE = google_firestore_database.main.name
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.main.id
    retry_policy          = "RETRY_POLICY_RETRY"
    service_account_email = google_service_account.cloud_functions.email
  }

  depends_on = [
    google_project_service.apis["cloudfunctions.googleapis.com"],
    google_project_service.apis["cloudbuild.googleapis.com"],
    google_project_service.apis["eventarc.googleapis.com"],
    google_project_service.apis["run.googleapis.com"],
  ]
}
