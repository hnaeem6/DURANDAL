#!/usr/bin/env bash
# ============================================================================
# DURANDAL Backup Script
# Creates durandal-backup-YYYY-MM-DD-HHMMSS.tar.gz containing:
#   - SQLite databases from durandal-data volume
#   - Hermes memory files
#   - Custom templates
#   - .env (with secrets masked)
#   - Docker compose config snapshot
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.yml"
ENV_FILE="$PROJECT_DIR/docker/.env"

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
# Output file
# ---------------------------------------------------------------------------
TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP_NAME="durandal-backup-${TIMESTAMP}"
OUTPUT_DIR="${1:-$PROJECT_DIR}"
BACKUP_FILE="${OUTPUT_DIR}/${BACKUP_NAME}.tar.gz"

WORK_DIR="$(mktemp -d)"
STAGING="$WORK_DIR/$BACKUP_NAME"
mkdir -p "$STAGING"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo ""
echo "${BOLD}DURANDAL Backup${RESET}"
echo "==============="
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
# 1. SQLite databases from the data volume
# ---------------------------------------------------------------------------
info "Backing up databases..."
mkdir -p "$STAGING/databases"

# Copy databases from the volume via a temporary container
# Uses SQLite .backup API when sqlite3 CLI is available for crash-safe copies;
# otherwise falls back to copying the DB plus WAL/SHM files.
if docker volume inspect durandal-data &>/dev/null 2>&1; then
  docker run --rm \
    -v durandal-data:/source:ro \
    -v "$STAGING/databases":/dest \
    alpine:latest \
    sh -c '
      apk add --no-cache sqlite >/dev/null 2>&1
      for f in $(find /source -name "*.db" -o -name "*.sqlite" -o -name "*.sqlite3"); do
        base=$(basename "$f")
        if command -v sqlite3 >/dev/null 2>&1; then
          sqlite3 "$f" ".backup /dest/$base" 2>/dev/null && continue
        fi
        # Fallback: copy the DB and its WAL/SHM companions
        cp "$f" "/dest/$base" 2>/dev/null
        [ -f "${f}-wal" ] && cp "${f}-wal" "/dest/${base}-wal" 2>/dev/null
        [ -f "${f}-shm" ] && cp "${f}-shm" "/dest/${base}-shm" 2>/dev/null
      done
      true
    '

  DB_COUNT=$(find "$STAGING/databases" -type f 2>/dev/null | wc -l | tr -d ' ')
  info "  Found $DB_COUNT database file(s)."
else
  warn "  durandal-data volume not found. Skipping databases."
fi

# ---------------------------------------------------------------------------
# 2. Hermes memory files
# ---------------------------------------------------------------------------
info "Backing up Hermes memory..."
mkdir -p "$STAGING/hermes"

if docker volume inspect durandal-data &>/dev/null 2>&1; then
  docker run --rm \
    -v durandal-data:/source:ro \
    -v "$STAGING/hermes":/dest \
    alpine:latest \
    sh -c 'if [ -d /source/hermes ]; then cp -r /source/hermes/* /dest/ 2>/dev/null; fi; true'

  HERMES_COUNT=$(find "$STAGING/hermes" -type f 2>/dev/null | wc -l | tr -d ' ')
  info "  Found $HERMES_COUNT Hermes memory file(s)."
else
  warn "  durandal-data volume not found. Skipping Hermes memory."
fi

# ---------------------------------------------------------------------------
# 3. Custom templates
# ---------------------------------------------------------------------------
info "Backing up templates..."
mkdir -p "$STAGING/templates"

TEMPLATE_DIR="$PROJECT_DIR/templates"
if [ -d "$TEMPLATE_DIR" ]; then
  cp -r "$TEMPLATE_DIR"/* "$STAGING/templates/" 2>/dev/null || true
  TMPL_COUNT=$(find "$STAGING/templates" -type f 2>/dev/null | wc -l | tr -d ' ')
  info "  Found $TMPL_COUNT template file(s)."
else
  warn "  No templates directory found."
fi

# ---------------------------------------------------------------------------
# 4. .env (masked secrets)
# ---------------------------------------------------------------------------
info "Backing up configuration..."
mkdir -p "$STAGING/config"

if [ -f "$ENV_FILE" ]; then
  # Mask sensitive values but keep the key names so restore knows the shape
  sed -E \
    -e 's/^(NEXTAUTH_SECRET=).+/\1****MASKED****/' \
    -e 's/^(DURANDAL_API_TOKEN=).+/\1****MASKED****/' \
    -e 's/^(OPENAI_API_KEY=).+/\1****MASKED****/' \
    -e 's/^(ANTHROPIC_API_KEY=).+/\1****MASKED****/' \
    -e 's/^(GOOGLE_AI_API_KEY=).+/\1****MASKED****/' \
    "$ENV_FILE" > "$STAGING/config/env.masked"
  info "  Saved .env (secrets masked)."
else
  warn "  No .env file found."
fi

# ---------------------------------------------------------------------------
# 5. Docker compose config snapshot
# ---------------------------------------------------------------------------
if [ -f "$COMPOSE_FILE" ]; then
  cp "$COMPOSE_FILE" "$STAGING/config/docker-compose.yml"
  info "  Saved docker-compose.yml snapshot."
fi

# Write metadata
cat > "$STAGING/backup-metadata.json" <<METAEOF
{
  "version": "1.0",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "platform": "$(uname -s)/$(uname -m)",
  "durandal_version": "$(cat "$PROJECT_DIR/package.json" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version": *"//;s/".*//' || echo 'unknown')"
}
METAEOF

# ---------------------------------------------------------------------------
# Create tarball
# ---------------------------------------------------------------------------
info "Creating archive..."
tar -czf "$BACKUP_FILE" -C "$WORK_DIR" "$BACKUP_NAME"

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"

echo ""
echo "${GREEN}${BOLD}Backup complete!${RESET}"
echo ""
echo "  ${CYAN}File:${RESET} $BACKUP_FILE"
echo "  ${CYAN}Size:${RESET} $BACKUP_SIZE"
echo ""
echo "  To restore: bash scripts/restore.sh $BACKUP_FILE"
echo ""
