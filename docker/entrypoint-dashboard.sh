#!/bin/sh
set -e

DB_PATH="${DATABASE_URL:-file:/data/durandal.db}"
DB_PATH="${DB_PATH#file:}"

MIGRATIONS_DIR="/app/packages/db/drizzle"

# Run database migrations using sqlite3 CLI
if [ -d "$MIGRATIONS_DIR" ] && command -v sqlite3 > /dev/null 2>&1; then
  echo "[entrypoint] Running database migrations..."

  # Create DB directory if it doesn't exist
  mkdir -p "$(dirname "$DB_PATH")" 2>/dev/null || true

  # Enable WAL mode
  sqlite3 "$DB_PATH" "PRAGMA journal_mode=WAL;" 2>/dev/null || true

  # Create migrations tracking table
  sqlite3 "$DB_PATH" "CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at INTEGER NOT NULL);" 2>/dev/null || true

  # Apply each migration SQL file in order
  for sql_file in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$sql_file" ]; then
      filename=$(basename "$sql_file")
      hash=$(echo "$filename" | sed 's/\.sql$//')

      # Check if already applied
      applied=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM __drizzle_migrations WHERE hash='$hash';" 2>/dev/null || echo "0")

      if [ "$applied" = "0" ]; then
        echo "[entrypoint]   Applying: $filename"
        sqlite3 "$DB_PATH" < "$sql_file" 2>/tmp/migration-error.log
        if [ $? -eq 0 ]; then
          sqlite3 "$DB_PATH" "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('$hash', $(date +%s));"
        else
          echo "[entrypoint]   ERROR applying $filename — see /tmp/migration-error.log"
          cat /tmp/migration-error.log
        fi
      fi
    fi
  done

  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] Skipping migrations (no sqlite3 or no migration files)."
fi

# Start the server
exec node apps/dashboard/server.js
