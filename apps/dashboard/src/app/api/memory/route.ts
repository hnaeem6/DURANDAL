import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 },
    );
  }
}
