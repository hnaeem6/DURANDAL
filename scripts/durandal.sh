#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_DIR="$(cd "$SCRIPT_DIR/../docker" && pwd)"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

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

# ---------------------------------------------------------------------------
# Docker check
# ---------------------------------------------------------------------------
if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed."
  exit 1
fi

# ---------------------------------------------------------------------------
# Version helper
# ---------------------------------------------------------------------------
get_version() {
  local version
  version="$(cat "$PROJECT_DIR/package.json" 2>/dev/null \
    | grep '"version"' | head -1 \
    | sed 's/.*"version": *"//;s/".*//' || echo 'unknown')"
  echo "$version"
}

# ---------------------------------------------------------------------------
# Health check helper
# ---------------------------------------------------------------------------
wait_for_health() {
  local max_wait="${1:-60}"
  local health_url="https://localhost/api/health"
  local waited=0

  while [ "$waited" -lt "$max_wait" ]; do
    if curl -ksfS "$health_url" > /dev/null 2>&1; then
      info "Health check passed!"
      return 0
    fi
    sleep 2
    waited=$((waited + 2))
    printf "\r  Waiting for health... (%ds / %ds)" "$waited" "$max_wait"
  done
  echo ""
  warn "Health check did not pass within ${max_wait}s."
  return 1
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  start)
    echo "Starting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    info "DURANDAL is running. Open https://localhost"
    ;;

  stop)
    echo "Stopping DURANDAL..."
    docker compose -f "$COMPOSE_FILE" down
    info "DURANDAL stopped."
    ;;

  restart)
    echo "Restarting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" restart
    info "DURANDAL restarted."
    ;;

  status)
    echo "DURANDAL Service Status"
    echo "======================"
    docker compose -f "$COMPOSE_FILE" ps
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "$@"
    ;;

  build)
    echo "Building DURANDAL images..."
    docker compose -f "$COMPOSE_FILE" build "$@"
    ;;

  # -----------------------------------------------------------------------
  # update: auto-backup, pull, restart, health check, rollback on failure
  # -----------------------------------------------------------------------
  update)
    DURANDAL_VERSION="$(get_version)"
    echo "${BOLD}Updating DURANDAL (current: v${DURANDAL_VERSION})${RESET}"
    echo ""

    # 1. Auto-backup before update
    info "Creating pre-update backup..."
    BACKUP_FILE=""
    if bash "$SCRIPT_DIR/backup.sh" "$PROJECT_DIR" 2>/dev/null; then
      BACKUP_FILE="$(ls -t "$PROJECT_DIR"/durandal-backup-*.tar.gz 2>/dev/null | head -1)"
      if [ -n "$BACKUP_FILE" ]; then
        info "Backup saved: $BACKUP_FILE"
      fi
    else
      warn "Pre-update backup failed. Continuing without backup."
    fi

    # 2. Pull latest code (if git repo)
    if [ -d "$PROJECT_DIR/.git" ]; then
      info "Pulling latest code..."
      git -C "$PROJECT_DIR" pull --ff-only || {
        warn "Could not fast-forward git. Continuing with current code."
      }
    fi

    # 3. Pull / rebuild images
    info "Pulling latest images..."
    docker compose -f "$COMPOSE_FILE" pull 2>/dev/null || true

    info "Rebuilding custom images..."
    docker compose -f "$COMPOSE_FILE" build || {
      error "Image build failed."
      if [ -n "$BACKUP_FILE" ]; then
        error "Rolling back using backup: $BACKUP_FILE"
        bash "$SCRIPT_DIR/restore.sh" "$BACKUP_FILE"
      fi
      exit 1
    }

    # 4. Restart services
    info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d || {
      error "Failed to start updated services."
      if [ -n "$BACKUP_FILE" ]; then
        error "Rolling back using backup: $BACKUP_FILE"
        bash "$SCRIPT_DIR/restore.sh" "$BACKUP_FILE"
      fi
      exit 1
    }

    # 5. Health check
    info "Verifying update..."
    if wait_for_health 60; then
      NEW_VERSION="$(get_version)"
      echo ""
      echo "${GREEN}${BOLD}Update successful!${RESET}"
      echo "  Version: v${NEW_VERSION}"
      echo ""
    else
      warn "Services may still be starting up."
      if [ -n "$BACKUP_FILE" ]; then
        warn "If issues persist, restore with: bash scripts/restore.sh $BACKUP_FILE"
      fi
    fi
    ;;

  # -----------------------------------------------------------------------
  # backup: delegate to backup.sh
  # -----------------------------------------------------------------------
  backup)
    OUTPUT="${1:-$PROJECT_DIR}"
    bash "$SCRIPT_DIR/backup.sh" "$OUTPUT"
    ;;

  # -----------------------------------------------------------------------
  # restore: delegate to restore.sh
  # -----------------------------------------------------------------------
  restore)
    if [ $# -lt 1 ]; then
      echo "Usage: durandal restore <backup-archive.tar.gz>"
      echo ""
      echo "Available backups:"
      ls -lt "$PROJECT_DIR"/durandal-backup-*.tar.gz 2>/dev/null | awk '{print "  " $NF}' || echo "  (none found)"
      exit 1
    fi
    bash "$SCRIPT_DIR/restore.sh" "$1"
    ;;

  # -----------------------------------------------------------------------
  # version: print DURANDAL version
  # -----------------------------------------------------------------------
  version)
    echo "DURANDAL v$(get_version)"
    ;;

  # -----------------------------------------------------------------------
  # help
  # -----------------------------------------------------------------------
  help|--help|-h)
    echo "${BOLD}DURANDAL CLI${RESET} v$(get_version)"
    echo ""
    echo "Usage: durandal <command> [options]"
    echo ""
    echo "${BOLD}Service commands:${RESET}"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show live logs (add service name to filter)"
    echo "  build       Build Docker images"
    echo ""
    echo "${BOLD}Update & maintenance:${RESET}"
    echo "  update      Update DURANDAL (auto-backup, pull, rebuild, health check)"
    echo "  backup      Create a backup archive"
    echo "  restore     Restore from a backup archive"
    echo "  version     Show DURANDAL version"
    echo ""
    echo "${BOLD}Help:${RESET}"
    echo "  help        Show this help message"
    ;;

  *)
    echo "Unknown command: $cmd"
    echo "Run 'durandal help' for usage."
    exit 1
    ;;
esac
