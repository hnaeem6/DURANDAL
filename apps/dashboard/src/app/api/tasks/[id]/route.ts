import { NextRequest, NextResponse } from "next/server";
import { getTask, cancelTask } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";
import { getAuthUser } from "@/lib/rbac";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const task = getTask(id);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getAuthUser();
  cancelTask(id);
  logAudit({ actor: user?.id ?? "system", action: "task.cancel", resource: `task:${id}` });
  return NextResponse.json({ ok: true });
}
