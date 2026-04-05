import { NextRequest, NextResponse } from "next/server";
import { createDb, schedules } from "@durandal/db";
import { config } from "@/lib/config";
import { getAuthUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

/**
 * Compute the next run time from a cron expression.
 * Uses cron-parser v5 (CronExpressionParser.parse).
 */
function computeNextRun(cronExpression: string): Date {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CronExpressionParser } = require("cron-parser") as typeof import("cron-parser");
  const expr = CronExpressionParser.parse(cronExpression);
  const next = expr.next();
  return next.toDate();
}

/**
 * Validate a cron expression. Returns null if valid, or an error string.
 */
function validateCron(cronExpression: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CronExpressionParser } = require("cron-parser") as typeof import("cron-parser");
    CronExpressionParser.parse(cronExpression);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Invalid cron expression";
  }
}

// GET /api/schedules — list all schedules, optionally filtered by templateId
export async function GET(req: NextRequest) {
  const db = getDb();
  const templateId = req.nextUrl.searchParams.get("templateId");

  let rows;
  if (templateId) {
    rows = db
      .select()
      .from(schedules)
      .where(eq(schedules.templateId, templateId))
      .all();
  } else {
    rows = db.select().from(schedules).all();
  }

  return NextResponse.json({ schedules: rows });
}

// POST /api/schedules — create a new schedule
export async function POST(req: NextRequest) {
  let body: { templateId?: string; parameters?: Record<string, string>; cronExpression?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { templateId, parameters, cronExpression } = body;

  if (!templateId || !cronExpression) {
    return NextResponse.json(
      { error: "templateId and cronExpression are required" },
      { status: 400 },
    );
  }

  // Validate cron expression
  const cronError = validateCron(cronExpression);
  if (cronError) {
    return NextResponse.json(
      { error: `Invalid cron expression: ${cronError}` },
      { status: 400 },
    );
  }

  const user = await getAuthUser();
  const actor = user?.id ?? "system";

  let nextRun: Date;
  try {
    nextRun = computeNextRun(cronExpression);
  } catch {
    return NextResponse.json(
      { error: "Failed to compute next run time" },
      { status: 400 },
    );
  }

  const id = crypto.randomUUID();
  const db = getDb();

  db.insert(schedules)
    .values({
      id,
      templateId,
      parameters: JSON.stringify(parameters ?? {}),
      cronExpression,
      enabled: true,
      nextRun,
      createdBy: actor,
      createdAt: new Date(),
    })
    .run();

  logAudit({
    actor,
    action: "schedule.create",
    resource: `schedule:${id}`,
    details: `Template: ${templateId}, cron: ${cronExpression}`,
  });

  // Return the created schedule
  const created = db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .get();

  return NextResponse.json({ schedule: created }, { status: 201 });
}
