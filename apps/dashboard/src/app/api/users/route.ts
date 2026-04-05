import { NextResponse } from "next/server";
import { createDb, users } from "@durandal/db";
import { desc } from "drizzle-orm";
import { config } from "@/lib/config";
import { requireRole } from "@/lib/rbac";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

export async function GET() {
  const denied = await requireRole("admin");
  if (denied) return denied;

  try {
    const db = getDb();
    const userList = db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .all();

    return NextResponse.json({ users: userList });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
