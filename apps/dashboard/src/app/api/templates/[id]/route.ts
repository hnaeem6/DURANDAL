import { NextRequest, NextResponse } from "next/server";
import { loadTemplate } from "@/lib/template-loader";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const template = loadTemplate(id);

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(template);
}
