import { NextResponse } from "next/server";
import { getDatabaseHealth, verifyDatabaseConnection } from "@/lib/prisma";

export async function GET() {
  const envStatus = getDatabaseHealth();
  const dbStatus = await verifyDatabaseConnection();

  return NextResponse.json({
    ok: envStatus.configured && dbStatus.ok,
    database: {
      ok: dbStatus.ok,
      status: dbStatus.status,
    },
  }, { status: envStatus.configured && dbStatus.ok ? 200 : 503 });
}
