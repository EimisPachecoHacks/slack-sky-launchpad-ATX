# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
# Outputs - GCP Serverless API
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

output "cloud_run_url" {
  description = "URL of the deployed Cloud Run API service"
  value       = google_cloud_run_v2_service.api.uri
}

output "firestore_database" {
  description = "Firestore database name"
  value       = google_firestore_database.main.name
}

output "pubsub_topic" {
  description = "Pub/Sub topic resource ID for publishing events"
  value       = google_pubsub_topic.main.id
}

output "pubsub_dead_letter_topic" {
  description = "Pub/Sub dead-letter topic resource ID"
  value       = google_pubsub_topic.dead_letter.id
}

output "cloud_tasks_queue" {
  description = "Cloud Tasks queue resource ID"
  value       = google_cloud_tasks_queue.main.id
}

output "service_account_email" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloud_run.email
}

output "cloud_functions_service_account_email" {
  description = "Cloud Functions service account email"
  value       = google_service_account.cloud_functions.email
}

output "event_processor_url" {
  description = "Cloud Functions v2 event processor URL"
  value       = google_cloudfunctions2_function.event_processor.url
}

output "vpc_connector_id" {
  description = "Serverless VPC Access connector ID"
  value       = google_vpc_access_connector.main.id
}
