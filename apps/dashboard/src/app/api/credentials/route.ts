import { NextRequest, NextResponse } from "next/server";
import { createDb, credentials } from "@durandal/db";
import { eq } from "drizzle-orm";
import { encrypt } from "@durandal/vault";
import { requireRole, getAuthUser } from "@/lib/rbac";
import { config } from "@/lib/config";
import { logAudit } from "@/lib/audit";

function getDb() {
  const dbPath = config.databaseUrl.replace("file:", "");
  return createDb(dbPath);
}

function getVaultKey(): string {
  return process.env.VAULT_MASTER_KEY ?? config.nextAuthSecret;
}

/**
 * GET /api/credentials — List all credentials (names only, no decrypted values).
 * Requires member role.
 */
export async function GET() {
  const denied = await requireRole("member");
  if (denied) return denied;

  try {
    const db = getDb();
    const rows = db
      .select({
        id: credentials.id,
        name: credentials.name,
        service: credentials.service,
        createdAt: credentials.createdAt,
      })
      .from(credentials)
      .all();

    return NextResponse.json({ credentials: rows });
  } catch {
    return NextResponse.json(
      { error: "Failed to list credentials" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/credentials — Store a new encrypted credential.
 * Requires admin role.
 */
export async function POST(req: NextRequest) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  try {
    const body = await req.json();
    const { name, service, value } = body as {
      name?: string;
      service?: string;
      value?: string;
    };

    if (!name || !service || !value) {
      return NextResponse.json(
        { error: "name, service, and value are required" },
        { status: 400 },
      );
    }

    const user = await getAuthUser();
    const vaultKey = getVaultKey();
    const encryptedStr = encrypt(value, vaultKey);

    // The encrypt() output is "salt:iv:tag:ciphertext" — extract IV for the schema column
    const ivHex = encryptedStr.split(":")[1];

    const db = getDb();
    const id = crypto.randomUUID();
    db.insert(credentials)
      .values({
        id,
        name,
        service,
        encryptedValue: encryptedStr,
        iv: ivHex,
        createdBy: user?.id ?? "system",
        createdAt: new Date(),
      })
      .run();

    logAudit({ actor: user?.email ?? "system", action: "credential.create", resource: `credential:${id}`, details: `${service}/${name}` });

    return NextResponse.json({ id, name, service }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to store credential" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/credentials — Remove a credential by id (query param).
 * Requires admin role.
 */
export async function DELETE(req: NextRequest) {
  const denied = await requireRole("admin");
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 },
      );
    }

    const db = getDb();
    const user = await getAuthUser();
    db.delete(credentials).where(eq(credentials.id, id)).run();

    logAudit({ actor: user?.email ?? "system", action: "credential.delete", resource: `credential:${id}` });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete credential" },
      { status: 500 },
    );
  }
}
