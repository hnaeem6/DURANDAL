import { NextResponse } from "next/server";
import { DURANDAL_VERSION } from "@durandal/core";
import { checkHermesHealth } from "@/lib/hermes-client";
import { checkNanoclawHealth } from "@/lib/nanoclaw-client";

export async function GET() {
  const [hermes, nanoclaw] = await Promise.all([
    checkHermesHealth(),
    checkNanoclawHealth(),
  ]);

  const status = hermes && nanoclaw ? "healthy" : "degraded";
  return NextResponse.json({
    status,
    version: DURANDAL_VERSION,
    services: {
      hermes: hermes ? "healthy" : "unhealthy",
      nanoclaw: nanoclaw ? "healthy" : "unhealthy",
    },
  }, { status: status === "healthy" ? 200 : 503 });
}
