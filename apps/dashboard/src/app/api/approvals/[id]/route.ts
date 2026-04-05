import { NextRequest, NextResponse } from "next/server";
import {
  getApproval,
  updateApprovalStatus,
} from "@/lib/approvals";
import { updateTaskStatus, addTaskEvent } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";
import { getAuthUser } from "@/lib/rbac";

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
    // Approved — mark task as executing so the step can proceed.
    // In a full async system the resumed execution would happen here;
    // for now we transition the task back to "executing" as a signal.
    updateTaskStatus(approval.taskId, "executing");
    addTaskEvent(
      approval.taskId,
      "step_start",
      `Step "${approval.stepName}" approved by ${actor} — resuming`,
      { approvalId: id, stepIndex: approval.stepIndex },
    );
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
