import { createDb } from "@durandal/db";
import { tasks, taskEvents } from "@durandal/db";
import { eq, desc } from "drizzle-orm";
import { config } from "./config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

export function createTask(input: {
  templateId?: string;
  input: string;
  createdBy: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date();

  db.insert(tasks)
    .values({
      id,
      templateId: input.templateId ?? null,
      status: "pending",
      input: input.input,
      output: null,
      error: null,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { id };
}

export function getTask(id: string) {
  const db = getDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return null;

  const events = db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, id))
    .orderBy(taskEvents.timestamp)
    .all();

  return { ...task, events };
}

export function listTasks(limit = 50) {
  const db = getDb();
  return db
    .select()
    .from(tasks)
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .all();
}

type TaskStatus =
  | "pending"
  | "planning"
  | "executing"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  output?: string,
  error?: string,
) {
  const db = getDb();
  const updates: Record<string, unknown> = { status, updatedAt: new Date() };
  if (output !== undefined) updates.output = output;
  if (error !== undefined) updates.error = error;

  db.update(tasks).set(updates).where(eq(tasks.id, id)).run();
}

type TaskEventType =
  | "created"
  | "planning"
  | "step_start"
  | "step_complete"
  | "step_failed"
  | "awaiting_approval"
  | "completed"
  | "failed";

export function addTaskEvent(
  taskId: string,
  type: TaskEventType,
  message: string,
  metadata?: Record<string, unknown>,
) {
  const db = getDb();
  db.insert(taskEvents)
    .values({
      id: crypto.randomUUID(),
      taskId,
      type,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
      timestamp: new Date(),
    })
    .run();
}

export function cancelTask(id: string) {
  updateTaskStatus(id, "cancelled");
}
