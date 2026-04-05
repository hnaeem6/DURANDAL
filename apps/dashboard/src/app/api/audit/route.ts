import { NextResponse } from "next/server";
import { createDb, auditLog } from "@durandal/db";
import { desc } from "drizzle-orm";
import { config } from "@/lib/config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

export async function GET() {
  try {
    const db = getDb();
    const entries = db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.timestamp))
      .limit(100)
      .all();

    return NextResponse.json({ entries });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 },
    );
  }
}
