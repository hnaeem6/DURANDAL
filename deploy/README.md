# DURANDAL Deployment

This directory contains infrastructure-as-code for deploying DURANDAL to Google Cloud Platform (GKE).

## Structure

```
deploy/
  helm/          # Helm 3 chart for Kubernetes deployment
  terraform/     # Terraform module for GCP infrastructure
```

## Prerequisites

- [Helm 3](https://helm.sh/docs/intro/install/)
- [Terraform >= 1.5](https://developer.hashicorp.com/terraform/install)
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) (authenticated)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- A GCP project with billing enabled
- Container images built and pushed to a registry

## Quick Start (Local / Existing Cluster)

The Helm chart works standalone against any Kubernetes cluster:

```bash
# From the repository root
helm install durandal ./deploy/helm \
  --set secrets.nextauthSecret="$(openssl rand -hex 32)" \
  --set secrets.durandalApiToken="$(openssl rand -hex 32)"
```

To customise values, copy and edit the defaults:

```bash
cp deploy/helm/values.yaml my-values.yaml
# edit my-values.yaml
helm install durandal ./deploy/helm -f my-values.yaml
```

## Full GCP Deployment

### 1. Provision Infrastructure with Terraform

```bash
cd deploy/terraform

terraform init
terraform plan -var="project_id=my-gcp-project"
terraform apply -var="project_id=my-gcp-project"
```

After apply completes, configure kubectl:

```bash
# The exact command is shown in terraform output
eval "$(terraform output -raw kubectl_config_command)"
```

### 2. Build and Push Container Images

```bash
# Tag images for your registry (e.g., Artifact Registry)
REGISTRY=us-central1-docker.pkg.dev/my-gcp-project/durandal

docker build -t $REGISTRY/dashboard:0.1.0 -f docker/Dockerfile.dashboard .
docker build -t $REGISTRY/hermes:0.1.0    -f docker/Dockerfile.hermes .
docker build -t $REGISTRY/nanoclaw:0.1.0  -f docker/Dockerfile.nanoclaw .

docker push $REGISTRY/dashboard:0.1.0
docker push $REGISTRY/hermes:0.1.0
docker push $REGISTRY/nanoclaw:0.1.0
```

### 3. Deploy with Helm

```bash
# Get Cloud SQL password from Terraform
DB_PASS=$(cd deploy/terraform && terraform output -raw cloud_sql_password)
SQL_CONN=$(cd deploy/terraform && terraform output -raw cloud_sql_connection_name)

helm install durandal ./deploy/helm \
  --set image.dashboard.repository=$REGISTRY/dashboard \
  --set image.hermes.repository=$REGISTRY/hermes \
  --set image.nanoclaw.repository=$REGISTRY/nanoclaw \
  --set cloudSQL.enabled=true \
  --set cloudSQL.host="$SQL_CONN" \
  --set cloudSQL.password="$DB_PASS" \
  --set secrets.nextauthSecret="$(openssl rand -hex 32)" \
  --set secrets.durandalApiToken="$(openssl rand -hex 32)" \
  --set ingress.hosts[0].host=durandal.yourdomain.com \
  --set ingress.tls[0].hosts[0]=durandal.yourdomain.com
```

### 4. Verify

```bash
kubectl get pods -l app.kubernetes.io/name=durandal
kubectl get ingress
```

## Upgrading

```bash
helm upgrade durandal ./deploy/helm -f my-values.yaml
```

## Uninstalling

```bash
helm uninstall durandal
# To destroy GCP infrastructure:
cd deploy/terraform && terraform destroy -var="project_id=my-gcp-project"
```

## Configuration Reference

| Value | Description | Default |
|---|---|---|
| `dashboard.replicaCount` | Dashboard pod replicas | `1` |
| `hermes.replicaCount` | Hermes pod replicas | `1` |
| `nanoclaw.replicaCount` | NanoClaw pod replicas | `1` |
| `ollama.enabled` | Deploy Ollama alongside the stack | `true` |
| `cloudSQL.enabled` | Use Cloud SQL instead of SQLite | `false` |
| `ingress.enabled` | Create an Ingress resource | `true` |
| `persistence.size` | Shared data volume size | `5Gi` |
| `secrets.nextauthSecret` | NextAuth session secret | `change-me-in-production` |
| `secrets.durandalApiToken` | Internal API token | `""` |

See `deploy/helm/values.yaml` for the full list of configurable values.
