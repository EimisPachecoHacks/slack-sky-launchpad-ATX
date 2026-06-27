locals {
  name_prefix = "${var.project_id}-webapp-${var.environment}"

  common_labels = merge(var.labels, {
    environment = var.environment
    team        = var.team
    cost_center = var.cost_center
    managed_by  = "skyrchitect"
  })
}

# -----------------------------------------------------------------------------
# Enable Required APIs
# -----------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# -----------------------------------------------------------------------------
# Networking — VPC, Subnets, Router, Cloud NAT
# -----------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = "${local.name_prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "web" {
  name          = "${local.name_prefix}-web-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_subnetwork" "db" {
  name          = "${local.name_prefix}-db-subnet"
  ip_cidr_range = "10.0.2.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

resource "google_compute_router" "router" {
  name    = "${local.name_prefix}-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

# ~$1-10/mo depending on traffic
resource "google_compute_router_nat" "nat" {
  name                               = "${local.name_prefix}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# -----------------------------------------------------------------------------
# Private Service Access (for Cloud SQL & Redis)
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "private_services" {
  name          = "${local.name_prefix}-private-svc-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.apis]
}

# -----------------------------------------------------------------------------
# Firewall Rules
# -----------------------------------------------------------------------------

resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${local.name_prefix}-deny-all-ingress"
  network = google_compute_network.vpc.id

  priority  = 65534
  direction = "INGRESS"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}

resource "google_compute_firewall" "allow_internal" {
  name    = "${local.name_prefix}-allow-internal"
  network = google_compute_network.vpc.id

  priority  = 1000
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}

resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${local.name_prefix}-allow-iap-ssh"
  network = google_compute_network.vpc.id

  priority  = 900
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["webapp"]
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${local.name_prefix}-allow-health-checks"
  network = google_compute_network.vpc.id

  priority  = 900
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["130.211.0.0/22", "35.191.0.0/16"]
  target_tags   = ["webapp"]
}

resource "google_compute_firewall" "allow_http_https_to_lb" {
  name    = "${local.name_prefix}-allow-http-https-lb"
  network = google_compute_network.vpc.id

  priority  = 800
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["webapp"]
}

# -----------------------------------------------------------------------------
# Service Account for Compute Instances
# -----------------------------------------------------------------------------

resource "google_service_account" "webapp" {
  account_id   = "webapp-${var.environment}-sa"
  display_name = "Three-Tier Web Application Service Account"
  project      = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_project_iam_member" "webapp_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.webapp.email}"
}

resource "google_project_iam_member" "webapp_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.webapp.email}"
}

# -----------------------------------------------------------------------------
# Compute — Instance Template, MIG, Autoscaler
# -----------------------------------------------------------------------------

resource "google_compute_instance_template" "webapp" {
  name_prefix  = "${local.name_prefix}-tmpl-"
  machine_type = var.machine_type
  region       = var.region
  tags         = ["webapp"]

  labels = local.common_labels

  disk {
    source_image = "debian-cloud/debian-12"
    auto_delete  = true
    boot         = true
    disk_type    = "pd-balanced"
    disk_size_gb = 20
  }

  network_interface {
    subnetwork = google_compute_subnetwork.web.id
  }

  service_account {
    email  = google_service_account.webapp.email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    # -------------------------------------------------------
    # STARTUP SCRIPT PLACEHOLDER
    # Replace with your application deployment logic.
    # -------------------------------------------------------
    set -euo pipefail
    apt-get update -y
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
    echo "Hello from $(hostname)" > /var/www/html/index.html
  SCRIPT

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_health_check" "webapp" {
  name                = "${local.name_prefix}-hc"
  check_interval_sec  = 10
  timeout_sec         = 5
  healthy_threshold   = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 80
    request_path = "/"
  }
}

# ~$12-245/mo depending on instance count and machine type
resource "google_compute_region_instance_group_manager" "webapp" {
  name               = "${local.name_prefix}-mig"
  base_instance_name = "${local.name_prefix}-vm"
  region             = var.region

  version {
    instance_template = google_compute_instance_template.webapp.id
  }

  named_port {
    name = "http"
    port = 80
  }

  auto_healing_policies {
    health_check      = google_compute_health_check.webapp.id
    initial_delay_sec = 120
  }

  update_policy {
    type                           = "PROACTIVE"
    minimal_action                 = "REPLACE"
    most_disruptive_allowed_action = "REPLACE"
    max_surge_fixed                = 3
    max_unavailable_fixed          = 0
  }
}

resource "google_compute_region_autoscaler" "webapp" {
  name   = "${local.name_prefix}-autoscaler"
  region = var.region
  target = google_compute_region_instance_group_manager.webapp.id

  autoscaling_policy {
    min_replicas    = var.min_replicas
    max_replicas    = var.max_replicas
    cooldown_period = 90

    cpu_utilization {
      target = 0.7
    }
  }
}

# -----------------------------------------------------------------------------
# HTTPS Load Balancer
# -----------------------------------------------------------------------------

resource "google_compute_global_address" "lb_ip" {
  name = "${local.name_prefix}-lb-ip"
}

# ~$18/mo base cost for forwarding rules
resource "google_compute_backend_service" "webapp" {
  name                  = "${local.name_prefix}-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  load_balancing_scheme = "EXTERNAL"
  health_checks         = [google_compute_health_check.webapp.id]
  enable_cdn            = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    negative_caching             = true
    serve_while_stale            = 86400
    signed_url_cache_max_age_sec = 7200
  }

  backend {
    group           = google_compute_region_instance_group_manager.webapp.instance_group
    balancing_mode  = "UTILIZATION"
    max_utilization = 0.8
    capacity_scaler = 1.0
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

resource "google_compute_url_map" "webapp" {
  name            = "${local.name_prefix}-url-map"
  default_service = google_compute_backend_service.webapp.id
}

resource "google_compute_target_http_proxy" "webapp" {
  name    = "${local.name_prefix}-http-proxy"
  url_map = google_compute_url_map.webapp.id
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "${local.name_prefix}-http-fwd"
  target                = google_compute_target_http_proxy.webapp.id
  port_range            = "80"
  ip_address            = google_compute_global_address.lb_ip.address
  load_balancing_scheme = "EXTERNAL"
}

# -----------------------------------------------------------------------------
# Cloud SQL — PostgreSQL 15 (Regional HA, Private IP, SSL)
# -----------------------------------------------------------------------------

resource "random_id" "db_suffix" {
  byte_length = 4
}

# ~$8-200/mo depending on tier and HA configuration
resource "google_sql_database_instance" "postgres" {
  name                = "${local.name_prefix}-pg-${random_id.db_suffix.hex}"
  database_version    = "POSTGRES_15"
  region              = var.region
  deletion_protection = var.enable_deletion_protection

  depends_on = [google_service_networking_connection.private_vpc]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 20
    disk_type         = "PD_SSD"

    user_labels = local.common_labels

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = google_compute_network.vpc.id
      enable_private_path_for_google_cloud_services = true

      ssl_mode = "ENCRYPTED_ONLY"
    }

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = var.environment == "prod" ? true : false
      transaction_log_retention_days = var.environment == "prod" ? 7 : 3

      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7
      hour         = 4
      update_track = "stable"
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }
}

resource "google_sql_database" "webapp" {
  name     = "webapp"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "webapp" {
  name     = "webapp"
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# -----------------------------------------------------------------------------
# Memorystore Redis
# -----------------------------------------------------------------------------

# ~$35-175/mo depending on memory size and tier
resource "google_redis_instance" "cache" {
  name               = "${local.name_prefix}-redis"
  tier               = var.environment == "prod" ? "STANDARD_HA" : "BASIC"
  memory_size_gb     = var.redis_memory_size_gb
  region             = var.region
  authorized_network = google_compute_network.vpc.id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  redis_version      = "REDIS_7_0"

  transit_encryption_mode = "SERVER_AUTHENTICATION"

  labels = local.common_labels

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"

      start_time {
        hours   = 5
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  depends_on = [google_service_networking_connection.private_vpc]
}

# -----------------------------------------------------------------------------
# Cloud Storage — Static Assets with CDN
# -----------------------------------------------------------------------------

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# ~$1-5/mo for storage; egress billed separately
resource "google_storage_bucket" "static_assets" {
  name          = "${local.name_prefix}-assets-${random_id.bucket_suffix.hex}"
  location      = var.region
  force_destroy = var.environment != "prod"
  storage_class = "STANDARD"

  labels = local.common_labels

  uniform_bucket_level_access = true

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
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.static_assets.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
