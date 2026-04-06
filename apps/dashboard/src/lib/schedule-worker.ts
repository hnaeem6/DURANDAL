/**
 * Schedule Worker — polls the `schedules` table every 60 seconds and
 * executes any enabled schedule whose `nextRun` is in the past.
 *
 * Designed to run inside the Next.js instrumentation hook so it shares
 * the dashboard process instead of requiring a separate service.
 */

import { createDb, schedules } from "@durandal/db";
import { eq, and, lte } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { loadTemplate } from "./template-loader";
import { createTask, updateTaskStatus, addTaskEvent } from "./tasks";
import { sendToHermes } from "./hermes-client";
import { logAudit } from "./audit";

const POLL_INTERVAL_MS = 60_000; // 60 seconds

function getDb() {
  const dbPath = (process.env.DATABASE_URL ?? "file:durandal.db").replace(
    "file:",
    "",
  );
  return createDb(dbPath);
}

/**
 * Compute the next run time from a cron expression, starting from `after`.
 */
function computeNextRun(cronExpression: string, after: Date): Date {
  const expr = CronExpressionParser.parse(cronExpression, {
    currentDate: after,
  });
  return expr.next().toDate();
}

/**
 * Process a single schedule: create a task, execute it via Hermes,
 * and update the schedule record.
 */
async function processSchedule(schedule: {
  id: string;
  templateId: string;
  parameters: string;
  cronExpression: string;
}): Promise<void> {
  const template = loadTemplate(schedule.templateId);
  if (!template) {
    console.error(
      `[schedule-worker] Template not found: ${schedule.templateId} (schedule ${schedule.id})`,
    );
    return;
  }

  // Build the prompt from template + stored parameters
  let params: Record<string, unknown> = {};
  try {
    params = JSON.parse(schedule.parameters);
  } catch {
    // parameters might be empty or invalid
  }

  const prompt = template.steps
    .map(
      (step) =>
        `[${step.name}] ${step.prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? `{{${key}}}`))}`
    )
    .join("\n");

  // Create and execute the task
  const { id: taskId } = createTask({
    input: `[scheduled] ${template.name}: ${prompt.slice(0, 200)}`,
    templateId: schedule.templateId,
    createdBy: "schedule-worker",
  });

  addTaskEvent(taskId, "created", `Scheduled execution of "${template.name}"`);

  try {
    updateTaskStatus(taskId, "executing");
    addTaskEvent(
      taskId,
      "planning",
      "Sending to Hermes for scheduled execution",
    );

    const result = await sendToHermes(prompt);

    updateTaskStatus(taskId, "completed", result.response);
    addTaskEvent(taskId, "completed", "Scheduled task completed successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    updateTaskStatus(taskId, "failed", undefined, errorMsg);
    addTaskEvent(taskId, "failed", `Scheduled task failed: ${errorMsg}`);
  }

  // Update schedule: lastRun = now, nextRun = next cron occurrence
  const now = new Date();
  const db = getDb();
  db.update(schedules)
    .set({
      lastRun: now,
      nextRun: computeNextRun(schedule.cronExpression, now),
    })
    .where(eq(schedules.id, schedule.id))
    .run();

  logAudit({
    actor: "schedule-worker",
    action: "schedule.execute",
    resource: `schedule:${schedule.id}`,
    details: `Executed template "${template.name}" (task ${taskId})`,
  });
}

/**
 * Single poll cycle: find all due schedules and process them.
 */
async function pollSchedules(): Promise<void> {
  try {
    const db = getDb();
    const now = new Date();

    const dueSchedules = db
      .select()
      .from(schedules)
      .where(and(eq(schedules.enabled, true), lte(schedules.nextRun, now)))
      .all();

    for (const schedule of dueSchedules) {
      try {
        await processSchedule(schedule);
      } catch (err) {
        console.error(
          `[schedule-worker] Error processing schedule ${schedule.id}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("[schedule-worker] Poll error:", err);
  }
}

/**
 * Start the schedule worker. Call once at process start.
 */
export function startScheduleWorker(): void {
  console.log("[schedule-worker] Starting schedule worker (poll every 60s)");

  // Run the first poll after a short delay to let the app stabilize
  setTimeout(() => {
    void pollSchedules();
  }, 5_000);

  // Then poll on the interval
  setInterval(() => {
    void pollSchedules();
  }, POLL_INTERVAL_MS);
}
