/**
 * DURANDAL — Opt-in Telemetry
 *
 * Collects anonymous, aggregated usage data ONLY when explicitly enabled
 * by the instance owner. Never collects content, credentials, PII, or
 * memory/conversation data.
 */

import { createDb, settings, tasks, users } from "@durandal/db";
import { eq, count } from "drizzle-orm";
import { DURANDAL_VERSION } from "@durandal/core";
import { config } from "./config";

const TELEMETRY_ENDPOINT = "https://telemetry.durandal.dev/v1/collect";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

/** Check whether telemetry is enabled in the settings table. */
export function isTelemetryEnabled(): boolean {
  const db = getDb();
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, "telemetry_enabled"))
    .get();

  return row?.value === "true";
}

/** Enable or disable telemetry. */
export function setTelemetryEnabled(enabled: boolean): void {
  const db = getDb();
  const now = new Date();

  db.insert(settings)
    .values({
      key: "telemetry_enabled",
      value: String(enabled),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(enabled), updatedAt: now },
    })
    .run();
}

/**
 * Telemetry payload shape. Every field is documented so the user can
 * preview exactly what would be sent before opting in.
 */
export interface TelemetryData {
  /** DURANDAL version (e.g. "0.1.0") */
  version: string;
  /** Total number of tasks ever created */
  taskCount: number;
  /** Breakdown of tasks by status */
  tasksByStatus: Record<string, number>;
  /** Number of registered users */
  userCount: number;
  /** OS platform (e.g. "linux", "darwin") */
  platform: string;
  /** Node.js version */
  nodeVersion: string;
  /** Timestamp of this telemetry report */
  collectedAt: string;
}

/**
 * Gather anonymous, aggregated telemetry data.
 *
 * NEVER includes:
 * - Task content / input / output
 * - User emails, names, or credentials
 * - Memory or conversation history
 * - License keys or secrets
 */
export function collectTelemetryData(): TelemetryData {
  const db = getDb();

  // Total task count
  const taskCountResult = db.select({ count: count() }).from(tasks).get();
  const taskCount = taskCountResult?.count ?? 0;

  // Tasks by status
  const allTasks = db
    .select({ status: tasks.status })
    .from(tasks)
    .all();

  const tasksByStatus: Record<string, number> = {};
  for (const t of allTasks) {
    tasksByStatus[t.status] = (tasksByStatus[t.status] ?? 0) + 1;
  }

  // User count
  const userCountResult = db.select({ count: count() }).from(users).get();
  const userCount = userCountResult?.count ?? 0;

  return {
    version: DURANDAL_VERSION,
    taskCount,
    tasksByStatus,
    userCount,
    platform: process.platform,
    nodeVersion: process.version,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Send telemetry data to the collection endpoint.
 * Only sends if telemetry is explicitly enabled.
 * Failures are silently ignored — telemetry must never break the app.
 */
export async function sendTelemetry(): Promise<boolean> {
  if (!isTelemetryEnabled()) {
    return false;
  }

  try {
    const data = collectTelemetryData();

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch {
    // Telemetry failures are silently ignored
    return false;
  }
}
