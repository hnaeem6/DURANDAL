import { createDb, auditLog } from "@durandal/db";
import { config } from "./config";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

export function logAudit(entry: {
  actor: string;
  action: string;
  resource: string;
  details?: string;
}) {
  const db = getDb();
  db.insert(auditLog)
    .values({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      details: entry.details ?? null,
    })
    .run();
}
