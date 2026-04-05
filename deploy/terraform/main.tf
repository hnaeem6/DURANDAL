# -------------------------------------------------------
# VPC
# -------------------------------------------------------
resource "google_compute_network" "vpc" {
  name                    = "${var.cluster_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name                     = "${var.cluster_name}-private"
  ip_cidr_range            = "10.10.0.0/20"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/16"
  }
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.30.0.0/20"
  }
}

# -------------------------------------------------------
# Firewall — allow HTTPS only
# -------------------------------------------------------
resource "google_compute_firewall" "allow_https" {
  name    = "${var.cluster_name}-allow-https"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${var.cluster_name}-node"]
}

resource "google_compute_firewall" "deny_all_ingress" {
  name     = "${var.cluster_name}-deny-all"
  network  = google_compute_network.vpc.name
  priority = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

# -------------------------------------------------------
# Service Account
# -------------------------------------------------------
resource "google_service_account" "durandal" {
  account_id   = "${var.cluster_name}-sa"
  display_name = "DURANDAL GKE Service Account"
}

resource "google_project_iam_member" "durandal_log_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.durandal.email}"
}

resource "google_project_iam_member" "durandal_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.durandal.email}"
}

resource "google_project_iam_member" "durandal_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.durandal.email}"
}

resource "google_project_iam_member" "durandal_sql_client" {
  count   = var.enable_cloud_sql ? 1 : 0
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.durandal.email}"
}

# -------------------------------------------------------
# GKE Autopilot Cluster
# -------------------------------------------------------
resource "google_container_cluster" "durandal" {
  name     = var.cluster_name
  location = var.region

  # Autopilot mode
  enable_autopilot = true

  network    = google_compute_network.vpc.id
  subnetwork = google_compute_subnetwork.private.id

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  release_channel {
    channel = "REGULAR"
  }

  deletion_protection = false
}

# -------------------------------------------------------
# Cloud SQL PostgreSQL (conditional)
# -------------------------------------------------------
resource "random_password" "db_password" {
  count   = var.enable_cloud_sql ? 1 : 0
  length  = 24
  special = false
}

resource "google_sql_database_instance" "durandal" {
  count            = var.enable_cloud_sql ? 1 : 0
  name             = "${var.cluster_name}-db"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.db_tier
    availability_type = "ZONAL"
    disk_autoresize   = true
    disk_size         = 10

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }
  }

  deletion_protection = false
}

resource "google_sql_database" "durandal" {
  count    = var.enable_cloud_sql ? 1 : 0
  name     = var.db_name
  instance = google_sql_database_instance.durandal[0].name
}

resource "google_sql_user" "durandal" {
  count    = var.enable_cloud_sql ? 1 : 0
  name     = var.db_user
  instance = google_sql_database_instance.durandal[0].name
  password = random_password.db_password[0].result
}

# -------------------------------------------------------
# Cloud Storage Bucket (Litestream backups)
# -------------------------------------------------------
resource "google_storage_bucket" "backups" {
  name          = "${var.project_id}-${var.cluster_name}-backups"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}
