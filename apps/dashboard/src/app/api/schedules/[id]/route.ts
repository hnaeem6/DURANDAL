import { NextRequest, NextResponse } from "next/server";
import { createDb, schedules } from "@durandal/db";
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

function computeNextRun(cronExpression: string): Date {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CronExpressionParser } = require("cron-parser") as typeof import("cron-parser");
  const expr = CronExpressionParser.parse(cronExpression);
  const next = expr.next();
  return next.toDate();
}

// GET /api/schedules/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const schedule = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(schedule);
}

// PUT /api/schedules/[id] — update schedule (enable/disable, change cron)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const existing = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!existing) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 },
    );
  }

  let body: { enabled?: boolean; cronExpression?: string; parameters?: Record<string, string> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") {
    updates.enabled = body.enabled;
  }

  if (body.cronExpression) {
    // Validate cron
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { CronExpressionParser } = require("cron-parser") as typeof import("cron-parser");
      CronExpressionParser.parse(body.cronExpression);
    } catch (err) {
      return NextResponse.json(
        {
          error: `Invalid cron expression: ${err instanceof Error ? err.message : "unknown"}`,
        },
        { status: 400 },
      );
    }
    updates.cronExpression = body.cronExpression;
  }

  if (body.parameters) {
    updates.parameters = JSON.stringify(body.parameters);
  }

  // Recompute nextRun if cron changed or if re-enabled
  const newCron = (updates.cronExpression as string) ?? existing.cronExpression;
  const isEnabled =
    typeof updates.enabled === "boolean" ? updates.enabled : existing.enabled;

  if (isEnabled) {
    try {
      updates.nextRun = computeNextRun(newCron);
    } catch {
      // keep existing
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  db.update(schedules).set(updates).where(eq(schedules.id, id)).run();

  const user = await getAuthUser();
  const actor = user?.id ?? "system";
  logAudit({
    actor,
    action: "schedule.update",
    resource: `schedule:${id}`,
    details: JSON.stringify(updates),
  });

  const updated = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  return NextResponse.json(updated);
}

// DELETE /api/schedules/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = getDb();

  const existing = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  if (!existing) {
    return NextResponse.json(
      { error: "Schedule not found" },
      { status: 404 },
    );
  }

  db.delete(schedules).where(eq(schedules.id, id)).run();

  const user = await getAuthUser();
  const actor = user?.id ?? "system";
  logAudit({
    actor,
    action: "schedule.delete",
    resource: `schedule:${id}`,
    details: `Template: ${existing.templateId}`,
  });

  return NextResponse.json({ deleted: true });
}
