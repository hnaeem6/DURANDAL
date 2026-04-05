import { NextRequest, NextResponse } from "next/server";
import { loadTemplate } from "@/lib/template-loader";
import {
  createTask,
  addTaskEvent,
  updateTaskStatus,
} from "@/lib/tasks";
import { sendToHermes } from "@/lib/hermes-client";
import { logAudit } from "@/lib/audit";
import { getAuthUser } from "@/lib/rbac";
import { createApproval } from "@/lib/approvals";

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

export async function POST(
  req: NextRequest,
  { params: routeParams }: { params: Promise<{ id: string }> },
) {
  const { id } = await routeParams;
  const template = loadTemplate(id);

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
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

  const templateParams = (body.params ?? {}) as Record<string, string>;

  // Validate required parameters
  const missingParams: string[] = [];
  for (const param of template.parameters) {
    if (param.required && !(param.name in templateParams)) {
      // Check if there's a default value
      if (param.default === undefined) {
        missingParams.push(param.name);
      }
    }
  }

  if (missingParams.length > 0) {
    return NextResponse.json(
      {
        error: "Missing required parameters",
        missing: missingParams,
      },
      { status: 400 },
    );
  }

  // Fill in defaults for unspecified optional params
  for (const param of template.parameters) {
    if (!(param.name in templateParams) && param.default !== undefined) {
      templateParams[param.name] = String(param.default);
    }
  }

  // Resolve the actor
  const user = await getAuthUser();
  const actor = user?.id ?? "system";

  // Create a task record
  const { id: taskId } = createTask({
    templateId: template.id,
    input: JSON.stringify({ template: template.id, params: templateParams }),
    createdBy: actor,
  });

  addTaskEvent(taskId, "created", `Template run: ${template.name}`);
  logAudit({
    actor,
    action: "template.run",
    resource: `task:${taskId}`,
    details: `Template: ${template.id}`,
  });

  // Execute steps sequentially
  updateTaskStatus(taskId, "executing");
  let sessionId: string | undefined;
  const stepResults: string[] = [];

  for (let i = 0; i < template.steps.length; i++) {
    const step = template.steps[i];
    const resolvedPrompt = substituteParams(step.prompt, templateParams);

    addTaskEvent(taskId, "step_start", `Step ${i + 1}: ${step.name}`, {
      stepIndex: i,
      stepName: step.name,
    });

    // If this step requires approval, pause and create an approval record
    if (step.requiresApproval) {
      updateTaskStatus(taskId, "awaiting_approval");
      addTaskEvent(
        taskId,
        "awaiting_approval",
        `Step ${i + 1} "${step.name}" requires human approval`,
        { stepIndex: i, stepName: step.name },
      );

      createApproval({
        taskId,
        stepIndex: i,
        stepName: step.name,
        prompt: resolvedPrompt,
      });

      logAudit({
        actor,
        action: "template.approval_required",
        resource: `task:${taskId}`,
        details: `Step ${i + 1}: ${step.name}`,
      });

      return NextResponse.json(
        {
          id: taskId,
          status: "awaiting_approval",
          completedSteps: i,
          awaitingStep: {
            index: i,
            name: step.name,
          },
          message: `Paused at step ${i + 1} "${step.name}" — human approval required`,
        },
        { status: 202 },
      );
    }

    // Execute the step via Hermes
    try {
      const result = await sendToHermes(resolvedPrompt, sessionId);
      sessionId = result.sessionId;
      stepResults.push(result.response);

      addTaskEvent(
        taskId,
        "step_complete",
        `Step ${i + 1} "${step.name}" completed`,
        { stepIndex: i, stepName: step.name },
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      updateTaskStatus(taskId, "failed", undefined, errorMsg);
      addTaskEvent(
        taskId,
        "step_failed",
        `Step ${i + 1} "${step.name}" failed: ${errorMsg}`,
        { stepIndex: i, stepName: step.name, error: errorMsg },
      );

      logAudit({
        actor,
        action: "template.step_failed",
        resource: `task:${taskId}`,
        details: `Step ${i + 1}: ${step.name} — ${errorMsg}`,
      });

      return NextResponse.json(
        {
          id: taskId,
          status: "failed",
          completedSteps: i,
          failedStep: {
            index: i,
            name: step.name,
            error: errorMsg,
          },
        },
        { status: 500 },
      );
    }
  }

  // All steps completed
  const output = JSON.stringify(stepResults);
  updateTaskStatus(taskId, "completed", output);
  addTaskEvent(taskId, "completed", "All template steps completed");

  logAudit({
    actor,
    action: "template.completed",
    resource: `task:${taskId}`,
    details: `Template: ${template.id}, steps: ${template.steps.length}`,
  });

  return NextResponse.json(
    {
      id: taskId,
      status: "completed",
      completedSteps: template.steps.length,
      results: stepResults,
    },
    { status: 200 },
  );
}
