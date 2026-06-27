---
name: gcp-security-hardening
description: >
  Apply Google Cloud Platform security best practices to Terraform configurations.
  Covers IAM, networking, encryption, secrets management, compliance frameworks,
  and defense-in-depth patterns.
metadata:
  slash-command: enabled
---

## GCP Security Hardening

Apply defense-in-depth security to all generated GCP Terraform infrastructure.

### IAM Best Practices

#### Per-Workload Service Accounts

Never use the default compute service account. Create dedicated SAs:

```hcl
resource "google_service_account" "app" {
  account_id   = "${var.project_id}-app-sa"
  display_name = "Application Service Account"
  description  = "SA for the application workload in ${var.environment}"
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.app.email}"
}
```

#### IAM Rules

- Use `google_project_iam_member` (additive) not `google_project_iam_binding` (authoritative) to avoid removing existing bindings
- Grant roles at the narrowest scope (resource > project > folder > org)
- Use custom roles when predefined roles are too broad
- Use IAM Conditions for time-based or resource-based access

#### Workload Identity for GKE

```hcl
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/${var.k8s_service_account}]"
}
```

### Network Security

#### VPC and Firewall

```hcl
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.project_id}-deny-all-ingress"
  network = google_compute_network.vpc.name

  priority  = 65534
  direction = "INGRESS"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_id}-allow-internal"
  network = google_compute_network.vpc.name

  priority  = 1000
  direction = "INGRESS"

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}

resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.project_id}-allow-iap-ssh"
  network = google_compute_network.vpc.name

  priority  = 1000
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP's IP range
  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["allow-ssh"]
}
```

#### Private Google Access

All subnets must enable Private Google Access so instances without external IPs can reach Google APIs:

```hcl
resource "google_compute_subnetwork" "private" {
  # ...
  private_ip_google_access = true
}
```

#### Cloud Armor (WAF)

```hcl
resource "google_compute_security_policy" "waf" {
  name = "${var.project_id}-waf-${var.environment}"

  rule {
    action   = "deny(403)"
    priority = 1000
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  rule {
    action   = "deny(403)"
    priority = 1001
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection"
  }

  rule {
    action   = "allow"
    priority = 2147483647
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }
}
```

### Encryption

#### Cloud KMS for Customer-Managed Encryption Keys (CMEK)

```hcl
resource "google_kms_key_ring" "main" {
  name     = "${var.project_id}-keyring-${var.environment}"
  location = var.region
}

resource "google_kms_crypto_key" "database" {
  name            = "${var.project_id}-db-key"
  key_ring        = google_kms_key_ring.main.id
  rotation_period = "7776000s"  # 90 days
  purpose         = "ENCRYPT_DECRYPT"

  lifecycle {
    prevent_destroy = true
  }
}
```

#### Secret Manager

```hcl
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_id}-db-password-${var.environment}"

  replication {
    auto {}
  }

  labels = local.common_labels
}

resource "google_secret_manager_secret_iam_member" "app_access" {
  secret_id = google_secret_manager_secret.db_password.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}
```

### Database Security

- SSL enforcement: `ssl_mode = "ENCRYPTED_ONLY"` on Cloud SQL
- Private IP only: `ipv4_enabled = false` with VPC peering
- Automated backups with point-in-time recovery
- `deletion_protection = true` in production
- IAM database authentication when possible
- Separate database users per application/service

### Audit Logging

```hcl
resource "google_project_iam_audit_config" "all_services" {
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
```

### Organization Policy Constraints (when applicable)

```hcl
resource "google_project_organization_policy" "disable_sa_key_creation" {
  project    = var.project_id
  constraint = "iam.disableServiceAccountKeyCreation"

  boolean_policy {
    enforced = true
  }
}

resource "google_project_organization_policy" "restrict_public_ip" {
  project    = var.project_id
  constraint = "compute.vmExternalIpAccess"

  list_policy {
    deny {
      all = true
    }
  }
}
```

### Compliance Mapping

| Framework | Key Terraform Controls |
|-----------|----------------------|
| SOC 2 | Audit logging, IAM least privilege, encryption at rest, access reviews |
| HIPAA | CMEK encryption, VPC Service Controls, BAA-covered services only, audit logs |
| PCI DSS | Network segmentation, WAF, encryption in transit, key rotation, access logs |
| ISO 27001 | Asset inventory (labels), access control (IAM), cryptography (KMS), logging |

### Security Checklist for Generated Code

- [ ] No default service accounts used
- [ ] No external IPs on databases or internal services
- [ ] SSL/TLS enforced on all connections
- [ ] Secrets in Secret Manager, not variables or env
- [ ] Firewall rules use deny-all default
- [ ] Audit logging enabled
- [ ] Deletion protection on stateful resources in prod
- [ ] Labels applied for asset inventory
- [ ] VPC with custom subnets (no default network)
