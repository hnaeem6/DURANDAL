import { NextRequest, NextResponse } from "next/server";
import { createDb, settings } from "@durandal/db";
import { eq } from "drizzle-orm";
import { getFeatureLimits } from "@durandal/core";
import { validateLicense } from "@durandal/core/license-verify";
import { requireRole } from "@/lib/rbac";
import { config } from "@/lib/config";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

/** GET /api/license — return current license status */
export async function GET() {
  const db = getDb();

  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, "license_key"))
    .get();

  if (!row) {
    return NextResponse.json({
      active: false,
      tier: "community",
      limits: getFeatureLimits("community"),
    });
  }

  const result = validateLicense(row.value);

  if (!result.valid) {
    return NextResponse.json({
      active: false,
      tier: "community",
      limits: getFeatureLimits("community"),
      error: result.error,
    });
  }

  return NextResponse.json({
    active: true,
    tier: result.payload!.tier,
    orgName: result.payload!.orgName,
    expiresAt: result.payload!.expiresAt,
    features: result.payload!.features,
    limits: getFeatureLimits(result.payload!.tier),
  });
}

/** POST /api/license — validate and store a license key */
export async function POST(req: NextRequest) {
  // Only owners can activate licenses
  const denied = await requireRole("owner");
  if (denied) return denied;

  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const licenseKey = body.key;
  if (!licenseKey || typeof licenseKey !== "string") {
    return NextResponse.json(
      { error: "License key is required" },
      { status: 400 },
    );
  }

  const result = validateLicense(licenseKey);

  if (!result.valid) {
    return NextResponse.json(
      { valid: false, error: result.error },
      { status: 400 },
    );
  }

  // Store in settings table
  const db = getDb();
  const now = new Date();

  db.insert(settings)
    .values({ key: "license_key", value: licenseKey, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: licenseKey, updatedAt: now },
    })
    .run();

  return NextResponse.json({
    valid: true,
    tier: result.payload!.tier,
    orgName: result.payload!.orgName,
    expiresAt: result.payload!.expiresAt,
    features: result.payload!.features,
    limits: getFeatureLimits(result.payload!.tier),
  });
}
