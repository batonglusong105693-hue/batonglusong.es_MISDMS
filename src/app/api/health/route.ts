import { NextResponse } from "next/server";
import { getDatabaseHealth, verifyDatabaseConnection } from "@/lib/prisma";

export async function GET() {
  const envStatus = getDatabaseHealth();
  const dbStatus = await verifyDatabaseConnection();

  return NextResponse.json({
    ok: envStatus.configured && dbStatus.ok,
    env: {
      hasDatabaseUrl: envStatus.hasDatabaseUrl,
      hasDirectUrl: envStatus.hasDirectUrl,
      hasNextAuthSecret: envStatus.hasNextAuthSecret,
    },
    database: dbStatus,
    message: dbStatus.ok
      ? "Application is connected to the database and ready to serve requests."
      : "Application cannot reach the database. Check Vercel environment variables and Supabase connectivity.",
  });
}
