#!/usr/bin/env bash
# ============================================================================
# DURANDAL Restore Script
# Restores from a backup archive created by scripts/backup.sh
#
# Usage: bash scripts/restore.sh <backup-archive.tar.gz>
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.yml"

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
if [ -t 1 ] && command -v tput &>/dev/null; then
  BOLD=$(tput bold) GREEN=$(tput setaf 2) YELLOW=$(tput setaf 3)
  RED=$(tput setaf 1) CYAN=$(tput setaf 6) RESET=$(tput sgr0)
else
  BOLD="" GREEN="" YELLOW="" RED="" CYAN="" RESET=""
fi

info()  { printf "%s[INFO]%s  %s\n" "$GREEN"  "$RESET" "$*"; }
warn()  { printf "%s[WARN]%s  %s\n" "$YELLOW" "$RESET" "$*"; }
error() { printf "%s[FAIL]%s  %s\n" "$RED"    "$RESET" "$*"; }
fail()  { error "$@"; exit 1; }

# ---------------------------------------------------------------------------
# Validate arguments
# ---------------------------------------------------------------------------
if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/restore.sh <backup-archive.tar.gz>"
  echo ""
  echo "Restores DURANDAL from a backup created by scripts/backup.sh"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  fail "Backup file not found: $BACKUP_FILE"
fi

# Make path absolute if relative
case "$BACKUP_FILE" in
  /*) ;; # already absolute
  *) BACKUP_FILE="$(pwd)/$BACKUP_FILE" ;;
esac

echo ""
echo "${BOLD}DURANDAL Restore${RESET}"
echo "================"
echo ""
echo "  ${CYAN}Archive:${RESET} $BACKUP_FILE"
echo ""

# ---------------------------------------------------------------------------
# Check Docker
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  fail "Docker is not installed."
fi

if ! docker info &>/dev/null 2>&1; then
  fail "Docker daemon is not running."
fi

# ---------------------------------------------------------------------------
# Confirmation prompt
# ---------------------------------------------------------------------------
if [ -t 0 ]; then
  printf "${YELLOW}This will stop services and restore data from the backup.${RESET}\n"
  printf "Continue? [y/N] "
  read -r CONFIRM
  case "$CONFIRM" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

# ---------------------------------------------------------------------------
# Extract archive to temp dir
# ---------------------------------------------------------------------------
WORK_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

info "Extracting backup archive..."
tar -xzf "$BACKUP_FILE" -C "$WORK_DIR"

# Find the backup directory (should be the sole top-level directory)
BACKUP_DIR="$(find "$WORK_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
if [ -z "$BACKUP_DIR" ]; then
  fail "Invalid backup archive: no top-level directory found."
fi

# Print metadata if available
if [ -f "$BACKUP_DIR/backup-metadata.json" ]; then
  info "Backup metadata:"
  cat "$BACKUP_DIR/backup-metadata.json" | while IFS= read -r line; do
    echo "    $line"
  done
fi

# ---------------------------------------------------------------------------
# 1. Stop services
# ---------------------------------------------------------------------------
info "Stopping DURANDAL services..."
docker compose -f "$COMPOSE_FILE" down 2>/dev/null || {
  warn "Could not stop services (they may not be running)."
}

# ---------------------------------------------------------------------------
# 2. Restore databases into volume
# ---------------------------------------------------------------------------
info "Restoring databases..."

# Ensure volume exists
docker volume inspect durandal-data &>/dev/null 2>&1 || docker volume create durandal-data

if [ -d "$BACKUP_DIR/databases" ] && [ "$(ls -A "$BACKUP_DIR/databases" 2>/dev/null)" ]; then
  docker run --rm \
    -v durandal-data:/dest \
    -v "$BACKUP_DIR/databases":/source:ro \
    alpine:latest \
    sh -c 'cp /source/* /dest/ 2>/dev/null; true'
  info "  Databases restored."
else
  warn "  No database files in backup."
fi

# ---------------------------------------------------------------------------
# 3. Restore Hermes memory
# ---------------------------------------------------------------------------
info "Restoring Hermes memory..."

if [ -d "$BACKUP_DIR/hermes" ] && [ "$(ls -A "$BACKUP_DIR/hermes" 2>/dev/null)" ]; then
  docker run --rm \
    -v durandal-data:/dest \
    -v "$BACKUP_DIR/hermes":/source:ro \
    alpine:latest \
    sh -c 'mkdir -p /dest/hermes && cp -r /source/* /dest/hermes/ 2>/dev/null; true'
  info "  Hermes memory restored."
else
  warn "  No Hermes memory files in backup."
fi

# ---------------------------------------------------------------------------
# 4. Restore templates (optional)
# ---------------------------------------------------------------------------
if [ -d "$BACKUP_DIR/templates" ] && [ "$(ls -A "$BACKUP_DIR/templates" 2>/dev/null)" ]; then
  info "Restoring templates..."
  TEMPLATE_DIR="$PROJECT_DIR/templates"
  mkdir -p "$TEMPLATE_DIR"
  cp -r "$BACKUP_DIR/templates"/* "$TEMPLATE_DIR/" 2>/dev/null || true
  info "  Templates restored."
fi

# ---------------------------------------------------------------------------
# 5. Restart services
# ---------------------------------------------------------------------------
info "Starting DURANDAL services..."
docker compose -f "$COMPOSE_FILE" up -d || {
  fail "Failed to start services after restore. Check 'docker compose logs' for details."
}

# ---------------------------------------------------------------------------
# 6. Health check
# ---------------------------------------------------------------------------
info "Waiting for health check..."

HEALTH_URL="https://localhost/api/health"
MAX_WAIT=60
WAITED=0

while [ "$WAITED" -lt "$MAX_WAIT" ]; do
  if curl -ksfS "$HEALTH_URL" > /dev/null 2>&1; then
    info "Health check passed!"
    break
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  printf "\r  Waiting for health... (%ds / %ds)" "$WAITED" "$MAX_WAIT"
done
echo ""

if [ "$WAITED" -ge "$MAX_WAIT" ]; then
  warn "Health check did not pass within ${MAX_WAIT}s."
  warn "Services may still be starting. Check: bash scripts/durandal.sh status"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "${GREEN}${BOLD}Restore complete!${RESET}"
echo ""
echo "  ${CYAN}Dashboard:${RESET} https://localhost"
echo "  ${CYAN}Status:${RESET}    bash scripts/durandal.sh status"
echo ""
