# Example Issue: Data Pipeline

> This is an example of how a user would create an infrastructure request issue.

---

## Infrastructure Request

### GCP Project

- **Project ID**: acme-analytics-prod
- **Environment**: prod
- **Region**: us-central1

### Architecture Type

**Type**: data-pipeline

### Description

We need a data pipeline that ingests event data from our application, processes it,
and loads it into BigQuery for analytics and dashboarding. Events arrive via Pub/Sub
in real-time and need to be available in BigQuery within 5 minutes.

Raw data should be archived in Cloud Storage for compliance (7-year retention).
We also need scheduled batch jobs that run nightly aggregations.

### Scale Requirements

- **Expected users**: N/A (automated pipeline)
- **Requests per second**: 1000 events/sec ingestion rate
- **Data volume**: 500GB initial, 50GB/month growth, 7-year retention

### GCP Services Needed

- [ ] Compute Engine (VMs)
- [ ] Cloud Run (serverless containers)
- [x] Cloud Functions (event-driven)
- [ ] GKE (Kubernetes)
- [ ] Cloud SQL (PostgreSQL/MySQL)
- [ ] Firestore (NoSQL)
- [x] BigQuery (analytics)
- [x] Cloud Storage (objects/files)
- [x] Pub/Sub (messaging)
- [ ] Cloud CDN
- [ ] Load Balancer
- [ ] VPC / Networking
- [ ] Memorystore (Redis)
- [x] Cloud Tasks / Scheduler

### Security & Compliance

- [ ] Private networking required
- [x] Encryption with customer-managed keys (CMEK)
- [ ] VPC Service Controls
- Compliance framework: SOC2

### Budget

- **Monthly budget**: $500/mo

### Additional Notes

BigQuery tables should be partitioned by date and clustered by event_type for query
performance. Cloud Storage should use lifecycle rules to move data to Coldline after
90 days and Archive after 1 year. We need Cloud Scheduler to trigger nightly
aggregation jobs at 2 AM UTC.

/label ~infrastructure ~skyrchitect
