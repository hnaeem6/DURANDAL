import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  isTelemetryEnabled,
  setTelemetryEnabled,
  collectTelemetryData,
} from "@/lib/telemetry";

/**
 * GET /api/telemetry
 *
 * Returns a preview of what telemetry data would be collected, plus the
 * current enabled/disabled status. This allows users to inspect exactly
 * what is sent before opting in.
 */
export async function GET() {
  const enabled = isTelemetryEnabled();
  const preview = collectTelemetryData();

  return NextResponse.json({
    enabled,
    preview,
    description:
      "This is exactly what would be sent. No task content, credentials, PII, or memory is ever collected.",
  });
}

/**
 * PUT /api/telemetry
 *
 * Enable or disable telemetry. Owner only.
 * Body: { enabled: boolean }
 */
export async function PUT(req: NextRequest) {
  const denied = await requireRole("owner");
  if (denied) return denied;

  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "'enabled' must be a boolean" },
      { status: 400 },
    );
  }

  setTelemetryEnabled(body.enabled);

  return NextResponse.json({
    enabled: body.enabled,
    message: body.enabled
      ? "Telemetry enabled. Thank you for helping improve DURANDAL."
      : "Telemetry disabled. No data will be collected.",
  });
}
