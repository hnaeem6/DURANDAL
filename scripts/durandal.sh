#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_DIR="$(cd "$SCRIPT_DIR/../docker" && pwd)"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"

if ! command -v docker &> /dev/null; then
  echo "Error: Docker is not installed."
  exit 1
fi

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in
  start)
    echo "Starting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "DURANDAL is running. Open https://localhost"
    ;;
  stop)
    echo "Stopping DURANDAL..."
    docker compose -f "$COMPOSE_FILE" down
    echo "DURANDAL stopped."
    ;;
  restart)
    echo "Restarting DURANDAL..."
    docker compose -f "$COMPOSE_FILE" restart
    echo "DURANDAL restarted."
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
  update)
    echo "Updating DURANDAL..."
    docker compose -f "$COMPOSE_FILE" pull
    docker compose -f "$COMPOSE_FILE" up -d
    echo "DURANDAL updated."
    ;;
  backup)
    BACKUP_FILE="durandal-backup-$(date +%Y-%m-%d).tar.gz"
    echo "Creating backup: $BACKUP_FILE"
    docker compose -f "$COMPOSE_FILE" exec dashboard \
      tar czf /tmp/backup.tar.gz /data/ 2>/dev/null
    docker compose -f "$COMPOSE_FILE" cp dashboard:/tmp/backup.tar.gz "./$BACKUP_FILE"
    echo "Backup saved to $BACKUP_FILE"
    ;;
  help|--help|-h)
    echo "DURANDAL CLI"
    echo ""
    echo "Usage: durandal <command>"
    echo ""
    echo "Commands:"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  status      Show service status"
    echo "  logs        Show live logs (add service name to filter)"
    echo "  build       Build Docker images"
    echo "  update      Pull latest images and restart"
    echo "  backup      Create a backup archive"
    echo "  help        Show this help message"
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Run 'durandal help' for usage."
    exit 1
    ;;
esac
