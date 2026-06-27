output "raw_bucket_name" {
  description = "Name of the raw landing zone Cloud Storage bucket"
  value       = google_storage_bucket.raw_landing_zone.name
}

output "raw_bucket_url" {
  description = "URL of the raw landing zone bucket"
  value       = google_storage_bucket.raw_landing_zone.url
}

output "processed_bucket_name" {
  description = "Name of the processed data Cloud Storage bucket"
  value       = google_storage_bucket.processed.name
}

output "processed_bucket_url" {
  description = "URL of the processed data bucket"
  value       = google_storage_bucket.processed.url
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for the data warehouse"
  value       = google_bigquery_dataset.data_warehouse.dataset_id
}

output "bigquery_events_table_id" {
  description = "Fully qualified BigQuery events table ID"
  value       = "${google_bigquery_dataset.data_warehouse.project}:${google_bigquery_dataset.data_warehouse.dataset_id}.${google_bigquery_table.events.table_id}"
}

output "pubsub_topic" {
  description = "Pub/Sub topic resource name for event ingestion"
  value       = google_pubsub_topic.data_ingestion.id
}

output "pubsub_subscription" {
  description = "Pub/Sub subscription resource name for event consumption"
  value       = google_pubsub_subscription.data_ingestion.id
}

output "pubsub_dead_letter_topic" {
  description = "Pub/Sub dead-letter topic for failed messages"
  value       = google_pubsub_topic.dead_letter.id
}

output "kms_key_id" {
  description = "Cloud KMS crypto key ID used for CMEK encryption"
  value       = google_kms_crypto_key.data_pipeline.id
  sensitive   = true
}

output "kms_key_ring_id" {
  description = "Cloud KMS key ring ID"
  value       = google_kms_key_ring.data_pipeline.id
  sensitive   = true
}

output "ingestion_service_account_email" {
  description = "Email of the data ingestion service account"
  value       = google_service_account.data_ingestion.email
}

output "processing_service_account_email" {
  description = "Email of the data processing service account"
  value       = google_service_account.data_processing.email
}

output "scheduler_job_name" {
  description = "Cloud Scheduler job name for nightly aggregation"
  value       = google_cloud_scheduler_job.nightly_aggregation.name
}
