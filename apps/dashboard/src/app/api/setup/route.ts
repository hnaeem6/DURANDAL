import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createDb, users } from "@durandal/db";
import { config } from "@/lib/config";
import { count } from "drizzle-orm";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

/**
 * GET /api/setup — Check if setup is needed (any users exist?)
 */
export async function GET() {
  try {
    const db = getDb();
    const result = db.select({ count: count() }).from(users).get();
    const userCount = result?.count ?? 0;

    return NextResponse.json({
      needsSetup: userCount === 0,
    });
  } catch (error) {
    console.error("Setup check failed:", error);
    return NextResponse.json(
      { error: "Failed to check setup status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/setup — Create first Owner account (only if no users exist)
 */
export async function POST(request: Request) {
  try {
    const db = getDb();

    // Check if users already exist
    const result = db.select({ count: count() }).from(users).get();
    const userCount = result?.count ?? 0;

    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup has already been completed" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Hash password with cost factor 12
    const passwordHash = await hash(password, 12);

    // Create the owner account
    const id = crypto.randomUUID();
    db.insert(users)
      .values({
        id,
        email,
        name,
        passwordHash,
        role: "owner",
        createdAt: new Date(),
      })
      .run();

    return NextResponse.json({
      success: true,
      message: "Owner account created successfully",
    });
  } catch (error) {
    console.error("Setup failed:", error);
    return NextResponse.json(
      { error: "Failed to create owner account" },
      { status: 500 }
    );
  }
}
