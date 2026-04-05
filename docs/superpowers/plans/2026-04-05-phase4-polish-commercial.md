# Phase 4: Polish & Commercial Packaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make DURANDAL production-ready for end users: one-command installer, update/backup system, offline license activation, opt-in telemetry, GCP deployment option, and documentation site.

**Architecture:** Shell-based installer with platform detection. RSA-signed JSON license keys validated offline. Anonymous telemetry with explicit opt-in. Helm chart + Terraform for GCP. Nextra-based docs site.

**Tech Stack additions:** node-rsa (license signing), Helm 3, Terraform, Nextra (docs)

**Spec Reference:** `docs/superpowers/specs/2026-04-05-durandal-platform-design.md` — Phase 4 (Section 5)

---

## Task Overview

| # | Task | Complexity |
|---|---|---|
| 1 | One-command installer script | Shell scripting |
| 2 | Update & backup system | Shell + API |
| 3 | License activation system | Crypto + API |
| 4 | Opt-in telemetry | API + UI |
| 5 | GCP deployment (Helm + Terraform) | DevOps |
| 6 | Documentation site | Content |
| 7 | .env.example + Docker polish | DevOps |
| 8 | Final verification + README update | Verification |

---

### Task 1: One-Command Installer

**Files:**
- Create: `scripts/install.sh`

- [ ] **Step 1: Create the installer script**

A comprehensive installer that:
1. Detects platform (macOS arm64/x86, Linux amd64/arm64, Windows/WSL)
2. Checks prerequisites: Docker, Docker Compose, minimum RAM (8GB), disk space (10GB)
3. Installs Docker if missing (via official get.docker.com script, with user confirmation)
4. Clones the DURANDAL repo (or downloads a release tarball)
5. Copies `.env.example` to `.env`, generates a random `NEXTAUTH_SECRET` and `DURANDAL_API_TOKEN`
6. Runs `docker compose pull` (for pre-built images) or `docker compose build`
7. Installs Ollama if not present (via official install script)
8. Pulls the default model via `scripts/setup-ollama.sh`
9. Starts all services via `docker compose up -d`
10. Waits for health checks to pass
11. Prints the dashboard URL and first-time setup instructions

The script should be safe to re-run (idempotent).

```bash
#!/usr/bin/env bash
set -euo pipefail
# ... (full installer content)
```

- [ ] **Step 2: Make executable**

`chmod +x scripts/install.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/install.sh
git commit -m "feat: add one-command installer script"
```

---

### Task 2: Update & Backup System

**Files:**
- Modify: `scripts/durandal.sh` (enhance update + backup commands)
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`

- [ ] **Step 1: Create dedicated backup script**

`scripts/backup.sh` — creates a comprehensive backup archive:
- SQLite databases (from Docker volume)
- Hermes memory files (MEMORY.md, USER.md)
- Custom templates
- Configuration (.env, but NOT secrets in plaintext — encrypt or exclude)
- Output: `durandal-backup-YYYY-MM-DD-HHMMSS.tar.gz`

- [ ] **Step 2: Create restore script**

`scripts/restore.sh` — restores from a backup archive:
- Stops services
- Extracts archive into correct locations
- Runs migrations
- Restarts services
- Verifies health

- [ ] **Step 3: Enhance durandal.sh update command**

Read existing `scripts/durandal.sh`. Enhance the `update` command to:
- Create automatic pre-update backup
- Pull new images
- Run database migrations on restart
- Verify health after update
- Rollback if health check fails (keep old images tagged)

- [ ] **Step 4: Commit**

```bash
git add scripts/
git commit -m "feat: add backup/restore scripts and enhance update command"
```

---

### Task 3: License Activation System

**Files:**
- Create: `packages/core/src/license.ts`
- Create: `apps/dashboard/src/app/api/license/route.ts`
- Create: `scripts/generate-license-key.sh`
- Modify: `apps/dashboard/src/app/(dashboard)/settings/page.tsx` (add license tab)

- [ ] **Step 1: Create license validation in @durandal/core**

`packages/core/src/license.ts`:
- RSA public key embedded (for offline verification)
- `LicensePayload` type: `{ tier, maxUsers, orgName, expiresAt, issuedAt }`
- `validateLicense(key: string): LicenseResult` — base64-decodes the key, verifies RSA signature, checks expiry
- `getLicenseFeatures(tier): FeatureSet` — maps tier to allowed features (template count, user count, SSO, etc.)

Tiers:
- `community`: 3 templates, 1 user, no SSO
- `pro`: unlimited templates, 10 users, cloud LLM
- `enterprise`: unlimited everything, SSO, custom integrations

For now, use a generated RSA keypair. The private key goes in `scripts/generate-license-key.sh`, the public key gets embedded in the code.

- [ ] **Step 2: Create license API route**

GET /api/license — return current license status
POST /api/license — activate a license key (validate and store in DB)

Add a `license` row to a simple key-value config table, or store in a new `settings` table.

- [ ] **Step 3: Add license key generation script**

`scripts/generate-license-key.sh` — takes tier, org, expiry as args, signs with private key, outputs the license key string. This is for the DURANDAL company to generate keys, not for end users.

- [ ] **Step 4: Add license tab to Settings page**

Show current license status, tier, expiry. Input field to enter a license key. "Activate" button.

- [ ] **Step 5: Commit**

```bash
git add packages/core/ apps/dashboard/ scripts/
git commit -m "feat: add offline RSA license activation system"
```

---

### Task 4: Opt-in Telemetry

**Files:**
- Create: `apps/dashboard/src/lib/telemetry.ts`
- Create: `apps/dashboard/src/app/api/telemetry/route.ts`
- Modify: Settings page (add telemetry toggle)

- [ ] **Step 1: Create telemetry module**

`apps/dashboard/src/lib/telemetry.ts`:
- `isTelemetryEnabled()` — checks settings table
- `sendTelemetry(data)` — sends anonymous data to telemetry endpoint (only if enabled)
- Data collected: DURANDAL version, task counts, template usage counts, error rates, platform info
- NEVER collects: task content, credentials, PII, memory, business data

- [ ] **Step 2: Create telemetry API route**

GET /api/telemetry — show what would be collected (preview mode)
PUT /api/telemetry — enable/disable telemetry (owner only)

- [ ] **Step 3: Add telemetry toggle to Settings**

Under Settings > General: a toggle switch for telemetry with clear disclosure of what's collected. Show exactly the data payload before enabling.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/
git commit -m "feat: add opt-in telemetry with transparent data disclosure"
```

---

### Task 5: GCP Deployment (Helm + Terraform)

**Files:**
- Create: `deploy/helm/Chart.yaml`
- Create: `deploy/helm/values.yaml`
- Create: `deploy/helm/templates/deployment.yaml`
- Create: `deploy/helm/templates/service.yaml`
- Create: `deploy/helm/templates/configmap.yaml`
- Create: `deploy/terraform/main.tf`
- Create: `deploy/terraform/variables.tf`
- Create: `deploy/terraform/outputs.tf`

- [ ] **Step 1: Create Helm chart**

A Helm chart that deploys DURANDAL to GKE with:
- Dashboard deployment + service
- Hermes deployment + service
- NanoClaw deployment + service
- Ollama deployment + service (optional, can use Vertex AI)
- Cloud SQL proxy sidecar (replaces SQLite for cloud)
- Ingress with managed TLS certificate
- ConfigMap for environment variables
- Secret for API tokens

- [ ] **Step 2: Create Terraform module**

A Terraform module that provisions on GCP:
- GKE Autopilot cluster
- Cloud SQL PostgreSQL instance
- Cloud Storage bucket (for backups)
- VPC + firewall rules
- Service account with minimal permissions
- Outputs: cluster endpoint, dashboard URL

- [ ] **Step 3: Commit**

```bash
git add deploy/
git commit -m "feat: add Helm chart and Terraform module for GCP deployment"
```

---

### Task 6: Documentation Site

**Files:**
- Create: `docs/site/package.json`
- Create: `docs/site/next.config.mjs`
- Create: `docs/site/pages/index.mdx`
- Create: `docs/site/pages/getting-started.mdx`
- Create: `docs/site/pages/templates.mdx`
- Create: `docs/site/pages/api-reference.mdx`
- Create: `docs/site/pages/security.mdx`
- Create: `docs/site/pages/deployment.mdx`

- [ ] **Step 1: Create docs site with Nextra**

A Nextra-based documentation site (Next.js + MDX) with pages:
- **Getting Started** — installation, first-run setup, running first template
- **Templates** — how to use built-in templates, creating custom templates, YAML schema reference
- **API Reference** — all REST API endpoints with request/response examples
- **Security** — architecture overview, container isolation, credential vault, audit logging
- **Deployment** — Docker Compose, GCP (Helm + Terraform), air-gap mode

Add to `pnpm-workspace.yaml`: `"docs/site"`.

- [ ] **Step 2: Commit**

```bash
git add docs/site/ pnpm-workspace.yaml
git commit -m "feat: add documentation site (Nextra)"
```

---

### Task 7: Docker Polish + .env.example

**Files:**
- Modify: `docker/.env.example` (comprehensive with all new env vars)
- Modify: `docker/docker-compose.yml` (add labels, healthcheck improvements)
- Create: `docker/docker-compose.prod.yml` (production overrides)

- [ ] **Step 1: Update .env.example**

Add all environment variables accumulated through Phases 1-4:
- `NEXTAUTH_SECRET`
- `DURANDAL_API_TOKEN`
- `OLLAMA_DEFAULT_MODEL`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`
- `VAULT_MASTER_KEY`
- `DURANDAL_TELEMETRY_ENABLED`
- `DURANDAL_LICENSE_KEY`

- [ ] **Step 2: Create production compose overrides**

`docker/docker-compose.prod.yml` with production-specific settings:
- Resource limits on all services
- No debug ports exposed
- Restart policies
- Logging driver configuration

- [ ] **Step 3: Commit**

```bash
git add docker/
git commit -m "feat: polish Docker configuration for production deployment"
```

---

### Task 8: Final Verification + README Update

- [ ] **Step 1: Full build** — `pnpm build`
- [ ] **Step 2: Lint** — `pnpm lint`
- [ ] **Step 3: Docker validate** — `docker compose config --quiet`
- [ ] **Step 4: Template validation** — all 5 templates parse
- [ ] **Step 5: Update README.md** with final project structure, all commands, architecture summary
- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "docs: update README for v0.1.0 release"
```
