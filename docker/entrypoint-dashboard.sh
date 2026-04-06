#!/bin/sh
set -e

# Run database migrations if the migration directory exists
MIGRATIONS_DIR="/app/packages/db/drizzle"
if [ -d "$MIGRATIONS_DIR" ]; then
  echo "[entrypoint] Running database migrations..."
  node -e "
    const { migrate } = require('drizzle-orm/better-sqlite3/migrator');
    const Database = require('better-sqlite3');
    const dbPath = (process.env.DATABASE_URL || 'file:/data/durandal.db').replace('file:', '');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    const { drizzle } = require('drizzle-orm/better-sqlite3');
    const driz = drizzle(db);
    migrate(driz, { migrationsFolder: '$MIGRATIONS_DIR' });
    db.close();
    console.log('[entrypoint] Migrations complete.');
  " 2>/dev/null || echo "[entrypoint] Migration skipped (tables may already exist)."
fi

# Start the server
exec node apps/dashboard/server.js
