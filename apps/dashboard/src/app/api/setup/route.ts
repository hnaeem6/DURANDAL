import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createDb, users } from "@durandal/db";
import { config } from "@/lib/config";
import { count } from "drizzle-orm";
import { logAudit } from "@/lib/audit";

function getDbPath() {
  return config.databaseUrl.replace("file:", "");
}

function getDb() {
  return createDb(getDbPath());
}

/**
 * GET /api/setup — Check if setup is needed (any users exist?)
 */
export async function GET() {
  try {
    const db = getDb();
    const result = db.select({ count: count() }).from(users).get();
    const userCount = result?.count ?? 0;

    return NextResponse.json({
      needsSetup: userCount === 0,
    });
  } catch {
    // Table doesn't exist yet = definitely needs setup
    return NextResponse.json({ needsSetup: true });
  }
}

/**
 * POST /api/setup — Create first Owner account (only if no users exist)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    // Bootstrap database tables (idempotent — safe on every call)
    // Use eval('require') to bypass webpack bundling of better-sqlite3
    try {
      const _require = eval("require");
      const BetterSqlite3 = _require("better-sqlite3");
      const rawDb = new BetterSqlite3(getDbPath());
      rawDb.pragma("journal_mode = WAL");
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, template_id TEXT, status TEXT NOT NULL DEFAULT 'pending', input TEXT NOT NULL, output TEXT, error TEXT, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, type TEXT NOT NULL, message TEXT NOT NULL, metadata TEXT, timestamp INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, details TEXT);
        CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, name TEXT NOT NULL, service TEXT NOT NULL, encrypted_value TEXT NOT NULL, iv TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, step_index INTEGER NOT NULL, step_name TEXT NOT NULL, prompt TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', reviewed_by TEXT, reviewed_at INTEGER, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, template_id TEXT NOT NULL, parameters TEXT NOT NULL, cron_expression TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, last_run INTEGER, next_run INTEGER, created_by TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
      `);
      rawDb.close();
    } catch (e) {
      console.warn("Bootstrap skipped:", e instanceof Error ? e.message : e);
    }

    const passwordHash = await hash(password, 12);

    const db = getDb();
    const id = crypto.randomUUID();
    const txResult = db.transaction((tx) => {
      const result = tx.select({ count: count() }).from(users).get();
      const userCount = result?.count ?? 0;

      if (userCount > 0) {
        return { alreadySetup: true } as const;
      }

      tx.insert(users)
        .values({
          id,
          email,
          name,
          passwordHash,
          role: "owner",
          createdAt: new Date(),
        })
        .run();

      return { alreadySetup: false } as const;
    });

    if (txResult.alreadySetup) {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 403 },
      );
    }

    logAudit({
      actor: email,
      action: "user.create",
      resource: `user:${id}`,
      details: "Owner account created via setup wizard",
    });

    return NextResponse.json({
      success: true,
      message: "Owner account created successfully",
    });
  } catch (error) {
    console.error("Setup failed:", error);
    return NextResponse.json(
      { error: "Failed to create owner account" },
      { status: 500 },
    );
  }
}
