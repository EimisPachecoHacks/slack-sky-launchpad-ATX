output "load_balancer_ip" {
  description = "The external IP address of the HTTPS load balancer"
  value       = google_compute_global_address.lb_ip.address
}

output "database_connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)"
  value       = google_sql_database_instance.postgres.connection_name
  sensitive   = true
}

output "redis_host" {
  description = "Memorystore Redis instance host IP"
  value       = google_redis_instance.cache.host
  sensitive   = true
}

output "storage_bucket_url" {
  description = "URL of the Cloud Storage bucket for static assets"
  value       = "gs://${google_storage_bucket.static_assets.name}"
}

output "vpc_id" {
  description = "The self-link of the VPC network"
  value       = google_compute_network.vpc.id
}
