import { NextRequest, NextResponse } from "next/server";
import {
  createTask,
  listTasks,
  addTaskEvent,
  updateTaskStatus,
} from "@/lib/tasks";
import { sendToHermes } from "@/lib/hermes-client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { input, templateId } = body;

  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  const { id } = createTask({
    input,
    templateId,
    createdBy: "system",
  });

  addTaskEvent(id, "created", `Task created: ${input.slice(0, 100)}`);

  // Execute synchronously for Phase 1 (Phase 2 adds async + WebSocket)
  try {
    updateTaskStatus(id, "executing");
    addTaskEvent(
      id,
      "planning",
      "Sending to Hermes for planning and execution",
    );

    const result = await sendToHermes(input);

    updateTaskStatus(id, "completed", result.response);
    addTaskEvent(id, "completed", "Task completed successfully");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    updateTaskStatus(id, "failed", undefined, errorMsg);
    addTaskEvent(id, "failed", `Task failed: ${errorMsg}`);
  }

  return NextResponse.json({ id }, { status: 201 });
}

export async function GET() {
  const taskList = listTasks();
  return NextResponse.json({ tasks: taskList });
}
