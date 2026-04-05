import { NextResponse } from "next/server";
import { loadAllTemplates } from "@/lib/template-loader";

export async function GET() {
  try {
    const templates = loadAllTemplates();
    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 },
    );
  }
}
