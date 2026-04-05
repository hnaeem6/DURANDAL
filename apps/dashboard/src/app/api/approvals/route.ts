import { NextResponse } from "next/server";
import { listPendingApprovals } from "@/lib/approvals";

export async function GET() {
  try {
    const pending = listPendingApprovals();
    return NextResponse.json({ approvals: pending });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch pending approvals" },
      { status: 500 },
    );
  }
}
