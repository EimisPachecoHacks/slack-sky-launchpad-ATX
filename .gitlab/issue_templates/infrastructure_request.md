## Infrastructure Request

<!-- Fill in the sections below. The Skyrchitect agent will read this issue
     and generate Terraform code based on your requirements. -->

### GCP Project

- **Project ID**: <!-- e.g., my-project-prod -->
- **Environment**: <!-- dev / staging / prod -->
- **Region**: <!-- e.g., us-central1, europe-west1 -->

### Architecture Type

<!-- Choose one: three-tier-webapp, serverless-api, data-pipeline, container-orchestration, custom -->

**Type**: 

### Description

<!-- Describe what you need. Be specific about the workload, expected traffic,
     and any technical constraints. -->



### Scale Requirements

- **Expected users**: <!-- e.g., 1000 concurrent -->
- **Requests per second**: <!-- e.g., 500 rps at peak -->
- **Data volume**: <!-- e.g., 100GB initial, 10GB/month growth -->

### GCP Services Needed

<!-- Check all that apply -->

- [ ] Compute Engine (VMs)
- [ ] Cloud Run (serverless containers)
- [ ] Cloud Functions (event-driven)
- [ ] GKE (Kubernetes)
- [ ] Cloud SQL (PostgreSQL/MySQL)
- [ ] Firestore (NoSQL)
- [ ] BigQuery (analytics)
- [ ] Cloud Storage (objects/files)
- [ ] Pub/Sub (messaging)
- [ ] Cloud CDN
- [ ] Load Balancer
- [ ] VPC / Networking
- [ ] Memorystore (Redis)
- [ ] Cloud Tasks / Scheduler
- [ ] Other: <!-- specify -->

### Security & Compliance

- [ ] Private networking required (no public IPs on backend)
- [ ] Encryption with customer-managed keys (CMEK)
- [ ] VPC Service Controls
- [ ] Compliance framework: <!-- SOC2 / HIPAA / PCI-DSS / none -->

### Budget

- **Monthly budget**: <!-- e.g., $500/mo, or "no constraint" -->

### Additional Notes

<!-- Any other requirements, preferences, or constraints -->



/label ~infrastructure ~skyrchitect
