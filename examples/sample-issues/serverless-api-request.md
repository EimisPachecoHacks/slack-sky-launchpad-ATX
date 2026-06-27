# Example Issue: Serverless API

> This is an example of how a user would create an infrastructure request issue.

---

## Infrastructure Request

### GCP Project

- **Project ID**: acme-notifications-dev
- **Environment**: dev
- **Region**: us-central1

### Architecture Type

**Type**: serverless-api

### Description

We're building a real-time notification service that receives events via webhooks,
processes them, and delivers notifications through multiple channels (email, push, SMS).
Traffic is very bursty -- near zero at night, spikes during business hours.

We need an API endpoint that accepts webhook events, a queue for reliable processing,
and a document database for storing notification preferences and history.

### Scale Requirements

- **Expected users**: 10,000 registered (50 concurrent API calls)
- **Requests per second**: 10 average, 500 peak during events
- **Data volume**: 5GB Firestore, 2GB/month growth

### GCP Services Needed

- [ ] Compute Engine (VMs)
- [x] Cloud Run (serverless containers)
- [x] Cloud Functions (event-driven)
- [ ] GKE (Kubernetes)
- [ ] Cloud SQL (PostgreSQL/MySQL)
- [x] Firestore (NoSQL)
- [ ] BigQuery (analytics)
- [ ] Cloud Storage (objects/files)
- [x] Pub/Sub (messaging)
- [ ] Cloud CDN
- [ ] Load Balancer
- [x] VPC / Networking
- [ ] Memorystore (Redis)
- [x] Cloud Tasks / Scheduler

### Security & Compliance

- [x] Private networking required (no public IPs on backend)
- [ ] Encryption with customer-managed keys (CMEK)
- [ ] VPC Service Controls
- Compliance framework: none

### Budget

- **Monthly budget**: $50/mo (should scale to zero when idle)

### Additional Notes

Cost is the primary concern for this dev environment. Everything should scale to zero
when not in use. We'll promote to staging/prod later with higher limits.

/label ~infrastructure ~skyrchitect
