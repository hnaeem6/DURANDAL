variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone (used for zonal resources)"
  type        = string
  default     = "us-central1-a"
}

variable "cluster_name" {
  description = "Name of the GKE cluster"
  type        = string
  default     = "durandal"
}

variable "db_tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "enable_cloud_sql" {
  description = "Enable Cloud SQL PostgreSQL instance (recommended for production)"
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Cloud SQL database name"
  type        = string
  default     = "durandal"
}

variable "db_user" {
  description = "Cloud SQL database user"
  type        = string
  default     = "durandal"
}
