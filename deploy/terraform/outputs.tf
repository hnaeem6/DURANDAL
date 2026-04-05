output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.durandal.endpoint
  sensitive   = true
}

output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.durandal.name
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name (project:region:instance)"
  value       = var.enable_cloud_sql ? google_sql_database_instance.durandal[0].connection_name : "N/A (Cloud SQL disabled)"
}

output "cloud_sql_password" {
  description = "Cloud SQL user password"
  value       = var.enable_cloud_sql ? random_password.db_password[0].result : ""
  sensitive   = true
}

output "backup_bucket_name" {
  description = "GCS bucket for Litestream backups"
  value       = google_storage_bucket.backups.name
}

output "kubectl_config_command" {
  description = "Run this command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.durandal.name} --region ${var.region} --project ${var.project_id}"
}

output "service_account_email" {
  description = "Service account email used by GKE workloads"
  value       = google_service_account.durandal.email
}
