import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const MEMORY_DIR = join(
  process.env.HERMES_DATA || "/data/hermes",
  "memories",
);

export async function GET() {
  try {
    const memoryPath = join(MEMORY_DIR, "MEMORY.md");
    const userPath = join(MEMORY_DIR, "USER.md");

    const memory = existsSync(memoryPath)
      ? readFileSync(memoryPath, "utf-8")
      : "";
    const user = existsSync(userPath)
      ? readFileSync(userPath, "utf-8")
      : "";

    return NextResponse.json({ memory, user });
  } catch {
    return NextResponse.json(
      { error: "Failed to read memory" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  try {
    const { memory, user } = await req.json();

    if (!existsSync(MEMORY_DIR)) {
      mkdirSync(MEMORY_DIR, { recursive: true });
    }

    if (memory !== undefined) {
      writeFileSync(join(MEMORY_DIR, "MEMORY.md"), memory, "utf-8");
    }
    if (user !== undefined) {
      writeFileSync(join(MEMORY_DIR, "USER.md"), user, "utf-8");
    }

    logAudit({ actor: "system", action: "memory.update", resource: "memory:agent", details: `Updated ${memory !== undefined ? "MEMORY.md" : ""}${memory !== undefined && user !== undefined ? " and " : ""}${user !== undefined ? "USER.md" : ""}`.trim() });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 },
    );
  }
}
