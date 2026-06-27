---
name: gcp-architecture-patterns
description: >
  Common Google Cloud Platform architecture patterns for Terraform generation.
  Includes three-tier web apps, serverless APIs, data pipelines, container
  orchestration, and multi-region disaster recovery patterns.
metadata:
  slash-command: enabled
---

## GCP Architecture Patterns

Reference patterns for generating GCP Terraform infrastructure. Select the pattern
that best matches the requirements and adapt as needed.

### Pattern 1: Three-Tier Web Application

Best for: traditional web applications with frontend, backend, and database tiers.

```
                    ┌─────────────────┐
                    │  Cloud DNS       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  HTTPS Load      │
                    │  Balancer        │
                    │  + Cloud Armor   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼───────┐ ┌───▼────────┐
     │ MIG Zone A    │ │ MIG Zone B │ │ MIG Zone C │
     │ (GCE)         │ │ (GCE)      │ │ (GCE)      │
     └────────┬──────┘ └────┬───────┘ └───┬────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼───────┐ ┌───▼────────┐
     │ Cloud SQL     │ │ Memorystore│ │ Cloud      │
     │ (HA)          │ │ (Redis)    │ │ Storage    │
     └───────────────┘ └────────────┘ └────────────┘
```

**GCP Services:**
- Cloud DNS for domain management
- Global HTTPS Load Balancer with Cloud Armor WAF
- Managed Instance Group (MIG) with autoscaler across zones
- Cloud SQL (PostgreSQL/MySQL) with regional HA
- Memorystore (Redis) for session/cache
- Cloud Storage for static assets and uploads
- Cloud CDN for static content delivery
- VPC with private subnets, Cloud NAT

**Terraform files:** `networking.tf`, `compute.tf`, `database.tf`, `storage.tf`, `loadbalancer.tf`, `dns.tf`

**Cost range:** $150-800/mo depending on scale

---

### Pattern 2: Serverless API

Best for: event-driven APIs, microservices, low/variable traffic.

```
     ┌────────────┐     ┌──────────────┐
     │ API Gateway │────▶│ Cloud Run    │
     └────────────┘     │ Service(s)   │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
     ┌────────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
     │ Firestore     │ │ Cloud Tasks  │ │ Secret       │
     │               │ │              │ │ Manager      │
     └───────────────┘ └──────┬───────┘ └──────────────┘
                              │
                     ┌────────▼────────┐
                     │ Cloud Functions │
                     │ (async work)    │
                     └─────────────────┘
```

**GCP Services:**
- API Gateway or Cloud Endpoints for routing
- Cloud Run for containerized API services (scale to zero)
- Firestore for NoSQL document storage
- Cloud Tasks for async job processing
- Cloud Functions for event-driven compute
- Secret Manager for API keys and credentials
- Cloud Pub/Sub for event messaging

**Terraform files:** `api_gateway.tf`, `cloud_run.tf`, `firestore.tf`, `pubsub.tf`, `functions.tf`

**Cost range:** $5-200/mo (scale-to-zero in non-prod)

---

### Pattern 3: Data Pipeline

Best for: ETL/ELT, analytics, batch processing, data warehousing.

```
     ┌────────────┐     ┌──────────────┐     ┌──────────────┐
     │ Cloud      │────▶│ Pub/Sub      │────▶│ Dataflow     │
     │ Storage    │     │ (ingestion)  │     │ (processing) │
     │ (raw data) │     └──────────────┘     └──────┬───────┘
     └────────────┘                                 │
                                                    │
                        ┌──────────────┐     ┌──────▼───────┐
                        │ Cloud        │◀────│ BigQuery     │
                        │ Scheduler    │     │ (warehouse)  │
                        └──────────────┘     └──────┬───────┘
                                                    │
                                             ┌──────▼───────┐
                                             │ Looker       │
                                             │ Studio       │
                                             └──────────────┘
```

**GCP Services:**
- Cloud Storage for raw data landing zone (multi-tier lifecycle)
- Pub/Sub for real-time data ingestion
- Dataflow (Apache Beam) for stream/batch processing
- BigQuery for data warehousing and analytics
- Cloud Scheduler for pipeline orchestration
- Cloud Composer (Airflow) for complex DAGs
- Looker Studio for dashboards

**Terraform files:** `storage.tf`, `pubsub.tf`, `dataflow.tf`, `bigquery.tf`, `scheduler.tf`

**Cost range:** $50-2000/mo depending on data volume

---

### Pattern 4: Container Orchestration (GKE)

Best for: microservices, complex deployments, teams with Kubernetes expertise.

```
     ┌────────────────┐
     │ Global LB      │
     │ + Cloud Armor  │
     └───────┬────────┘
             │
     ┌───────▼────────┐
     │ GKE Cluster    │
     │ ┌────────────┐ │
     │ │ Node Pool  │ │     ┌──────────────┐
     │ │ (app pods) │ │────▶│ Artifact     │
     │ └────────────┘ │     │ Registry     │
     │ ┌────────────┐ │     └──────────────┘
     │ │ Node Pool  │ │
     │ │ (workers)  │ │     ┌──────────────┐
     │ └────────────┘ │────▶│ Cloud SQL    │
     └────────────────┘     │ (private IP) │
                            └──────────────┘
```

**GCP Services:**
- GKE with private cluster, Workload Identity
- Artifact Registry for container images
- Cloud SQL (private IP) for persistence
- Global HTTP(S) Load Balancer with managed SSL
- Cloud Armor for WAF
- Cloud Monitoring and Cloud Logging
- Binary Authorization for supply chain security

**Terraform files:** `gke.tf`, `node_pools.tf`, `networking.tf`, `database.tf`, `registry.tf`, `monitoring.tf`

**Cost range:** $200-2000/mo

---

### Pattern 5: Multi-Region / Disaster Recovery

Best for: production workloads requiring high availability and geographic redundancy.

```
     ┌──────────────────────────────────────┐
     │         Global Load Balancer          │
     └───────────┬──────────────┬───────────┘
                 │              │
     ┌───────────▼──────┐  ┌───▼───────────┐
     │ Region A         │  │ Region B      │
     │ ┌──────────────┐ │  │ ┌────────────┐│
     │ │ Cloud Run /  │ │  │ │ Cloud Run /││
     │ │ GCE MIG      │ │  │ │ GCE MIG    ││
     │ └──────┬───────┘ │  │ └────┬───────┘│
     │        │         │  │      │        │
     │ ┌──────▼───────┐ │  │ ┌────▼───────┐│
     │ │ Cloud SQL    │──────│ Read       ││
     │ │ Primary      │ │  │ │ Replica    ││
     │ └──────────────┘ │  │ └────────────┘│
     └──────────────────┘  └───────────────┘
```

**Key configurations:**
- Global LB distributes across regions
- Cloud SQL cross-region read replicas with automatic failover
- Cloud Storage multi-region buckets
- Cloud DNS with health checks and failover routing
- Cloud Spanner for globally consistent multi-region databases

**RPO/RTO targets:**

| Strategy | RPO | RTO | Cost Multiplier |
|----------|-----|-----|-----------------|
| Backup & restore | Hours | Hours | 1.1x |
| Pilot light | Minutes | Minutes | 1.3x |
| Warm standby | Seconds | Minutes | 1.5x |
| Active-active | Zero | Zero | 2x+ |

---

### Pattern Selection Guide

| Requirement | Recommended Pattern |
|-------------|-------------------|
| Simple web app, < 1000 users | Three-Tier |
| API-first, variable traffic | Serverless |
| Heavy data processing/analytics | Data Pipeline |
| Many microservices, K8s team | Container (GKE) |
| Mission-critical, multi-region | DR on top of any pattern |
| Budget < $50/mo | Serverless (scale to zero) |
| Compliance (HIPAA, PCI) | Three-Tier or GKE with hardening |

### Network CIDR Planning

Standard allocation for multi-environment setups:

| Environment | VPC CIDR | Private Subnet | GKE Pods | GKE Services |
|-------------|----------|---------------|----------|---------------|
| dev | 10.0.0.0/16 | 10.0.1.0/24 | 10.0.16.0/20 | 10.0.32.0/24 |
| staging | 10.1.0.0/16 | 10.1.1.0/24 | 10.1.16.0/20 | 10.1.32.0/24 |
| prod | 10.2.0.0/16 | 10.2.1.0/24 | 10.2.16.0/20 | 10.2.32.0/24 |
