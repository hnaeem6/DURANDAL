import { createDb, approvals, tasks } from "@durandal/db";
import { eq, desc } from "drizzle-orm";
import { config } from "./config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

export function createApproval(input: {
  taskId: string;
  stepIndex: number;
  stepName: string;
  prompt: string;
}) {
  const db = getDb();
  const id = crypto.randomUUID();

  db.insert(approvals)
    .values({
      id,
      taskId: input.taskId,
      stepIndex: input.stepIndex,
      stepName: input.stepName,
      prompt: input.prompt,
      status: "pending",
      createdAt: new Date(),
    })
    .run();

  return { id };
}

export function getApproval(id: string) {
  const db = getDb();
  return db.select().from(approvals).where(eq(approvals.id, id)).get() ?? null;
}

export function listPendingApprovals() {
  const db = getDb();
  return db
    .select({
      id: approvals.id,
      taskId: approvals.taskId,
      stepIndex: approvals.stepIndex,
      stepName: approvals.stepName,
      prompt: approvals.prompt,
      status: approvals.status,
      createdAt: approvals.createdAt,
      taskInput: tasks.input,
      taskStatus: tasks.status,
      taskTemplateId: tasks.templateId,
    })
    .from(approvals)
    .leftJoin(tasks, eq(approvals.taskId, tasks.id))
    .where(eq(approvals.status, "pending"))
    .orderBy(desc(approvals.createdAt))
    .all();
}

export function updateApprovalStatus(
  id: string,
  action: "approved" | "rejected",
  reviewedBy: string,
) {
  const db = getDb();
  db.update(approvals)
    .set({
      status: action,
      reviewedBy,
      reviewedAt: new Date(),
    })
    .where(eq(approvals.id, id))
    .run();
}
