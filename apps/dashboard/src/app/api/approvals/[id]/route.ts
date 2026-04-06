import { NextRequest, NextResponse } from "next/server";
import {
  getApproval,
  updateApprovalStatus,
} from "@/lib/approvals";
import { getTask, updateTaskStatus, addTaskEvent } from "@/lib/tasks";
import { loadTemplate } from "@/lib/template-loader";
import { sendToHermes } from "@/lib/hermes-client";
import { logAudit } from "@/lib/audit";
import { getAuthUser, requireRole } from "@/lib/rbac";

/**
 * Substitute `{{param}}` placeholders in a string with the provided values.
 */
function substituteParams(
  text: string,
  params: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return params[key] ?? `{{${key}}}`;
  });
}

/**
 * Resume template execution from the step after the one that was approved.
 * Runs asynchronously so it does not block the approval response.
 */
async function resumeTemplateExecution(
  taskId: string,
  approvedStepIndex: number,
): Promise<void> {
  const task = getTask(taskId);
  if (!task || !task.templateId) return;

  const template = loadTemplate(task.templateId);
  if (!template) {
    console.error(
      `[approval-resume] Template not found: ${task.templateId} (task ${taskId})`,
    );
    return;
  }

  // Parse stored parameters from task input so we can substitute {{param}} placeholders
  let taskParams: Record<string, string> = {};
  try {
    const parsed = JSON.parse(task.input);
    taskParams = parsed.params ?? {};
  } catch { /* task.input may be plain text */ }

  const remainingSteps = template.steps.slice(approvedStepIndex + 1);
  if (remainingSteps.length === 0) {
    // No more steps — mark task completed
    updateTaskStatus(taskId, "completed");
    addTaskEvent(taskId, "completed", "All steps completed after approval");
    return;
  }

  try {
    for (let i = 0; i < remainingSteps.length; i++) {
      const step = remainingSteps[i];
      const globalIndex = approvedStepIndex + 1 + i;

      addTaskEvent(taskId, "step_start", `Executing step "${step.name}"`, {
        stepIndex: globalIndex,
      });

      const resolvedPrompt = substituteParams(step.prompt, taskParams);
      const result = await sendToHermes(resolvedPrompt);

      addTaskEvent(
        taskId,
        "step_complete",
        `Step "${step.name}" completed`,
        { stepIndex: globalIndex, response: result.response.slice(0, 500) },
      );
    }

    updateTaskStatus(taskId, "completed", "All steps completed after approval resume");
    addTaskEvent(taskId, "completed", "Task completed successfully after approval resume");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    updateTaskStatus(taskId, "failed", undefined, errorMsg);
    addTaskEvent(taskId, "failed", `Task failed during resume: ${errorMsg}`);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const approval = getApproval(id);

  if (!approval) {
    return NextResponse.json(
      { error: "Approval not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(approval);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const approval = getApproval(id);

  if (!approval) {
    return NextResponse.json(
      { error: "Approval not found" },
      { status: 404 },
    );
  }

  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `Approval already ${approval.status}` },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const action = body.action as string;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  }

  // Approving/rejecting is a privileged operation — require admin role
  const roleCheck = await requireRole("admin");
  if (roleCheck) return roleCheck;

  const user = await getAuthUser();
  const actor = user?.id ?? "system";

  const status = action === "approve" ? "approved" : "rejected";
  updateApprovalStatus(id, status, actor);

  // Update the parent task based on the decision
  if (action === "reject") {
    updateTaskStatus(approval.taskId, "cancelled");
    addTaskEvent(
      approval.taskId,
      "failed",
      `Step "${approval.stepName}" rejected by ${actor}`,
      { approvalId: id, stepIndex: approval.stepIndex },
    );
  } else {
    // Approved — mark task as executing and resume remaining steps
    updateTaskStatus(approval.taskId, "executing");
    addTaskEvent(
      approval.taskId,
      "step_start",
      `Step "${approval.stepName}" approved by ${actor} — resuming`,
      { approvalId: id, stepIndex: approval.stepIndex },
    );
    // Resume execution asynchronously (don't block the response)
    void resumeTemplateExecution(approval.taskId, approval.stepIndex);
  }

  logAudit({
    actor,
    action: `approval.${action}`,
    resource: `approval:${id}`,
    details: `Task: ${approval.taskId}, step: ${approval.stepName}`,
  });

  return NextResponse.json({
    id,
    status,
    taskId: approval.taskId,
    action,
  });
}
