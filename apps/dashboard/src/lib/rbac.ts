import { auth } from "./auth";
import { NextResponse } from "next/server";

type Role = "owner" | "admin" | "member";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function hasRole(userRole: string, requiredRole: Role): boolean {
  return (
    (ROLE_HIERARCHY[userRole as Role] ?? 0) >= ROLE_HIERARCHY[requiredRole]
  );
}

export async function requireRole(requiredRole: Role) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userRole = (session.user as Record<string, unknown>).role as string;
  if (!hasRole(userRole, requiredRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null; // Access granted
}

export async function getAuthUser() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: (session.user as Record<string, unknown>).id as string,
    email: session.user.email!,
    name: session.user.name!,
    role: (session.user as Record<string, unknown>).role as Role,
  };
}
