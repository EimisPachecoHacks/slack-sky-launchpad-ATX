# Example Issue: Three-Tier Web Application

> This is an example of how a user would create an infrastructure request issue.
> Copy this into a new issue using the `infrastructure_request` template.

---

## Infrastructure Request

### GCP Project

- **Project ID**: acme-webapp-prod
- **Environment**: prod
- **Region**: us-central1

### Architecture Type

**Type**: three-tier-webapp

### Description

We need a production web application infrastructure for our customer-facing SaaS platform.
The application is a Python/Django backend serving a React frontend. We need a PostgreSQL
database, Redis for session caching, and Cloud Storage for user-uploaded files.

The app currently handles about 500 concurrent users but we expect to grow to 2000
over the next 6 months. We need auto-scaling and high availability.

### Scale Requirements

- **Expected users**: 500 concurrent, growing to 2000
- **Requests per second**: 200 rps average, 800 rps peak
- **Data volume**: 50GB database, 200GB file storage, 5GB/month growth

### GCP Services Needed

- [x] Compute Engine (VMs)
- [ ] Cloud Run (serverless containers)
- [ ] Cloud Functions (event-driven)
- [ ] GKE (Kubernetes)
- [x] Cloud SQL (PostgreSQL/MySQL)
- [ ] Firestore (NoSQL)
- [ ] BigQuery (analytics)
- [x] Cloud Storage (objects/files)
- [ ] Pub/Sub (messaging)
- [x] Cloud CDN
- [x] Load Balancer
- [x] VPC / Networking
- [x] Memorystore (Redis)
- [ ] Cloud Tasks / Scheduler

### Security & Compliance

- [x] Private networking required (no public IPs on backend)
- [ ] Encryption with customer-managed keys (CMEK)
- [ ] VPC Service Controls
- Compliance framework: SOC2

### Budget

- **Monthly budget**: $800/mo

### Additional Notes

We want automated backups for the database with 30-day retention. The frontend static
files should be served via CDN for performance. We need Cloud NAT for outbound internet
access from the private VMs.

/label ~infrastructure ~skyrchitect
