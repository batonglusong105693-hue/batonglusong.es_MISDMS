import { PrismaClient } from "@prisma/client";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl) {
  console.warn("[prisma] DATABASE_URL is not configured. Prisma queries will fail until it is set.");
}

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === "production" ? ["error"] : ["query", "error", "warn"],
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getDatabaseHealth() {
  return {
    configured: hasDatabaseUrl,
    hasDatabaseUrl,
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
  };
}

export async function verifyDatabaseConnection() {
  if (!hasDatabaseUrl) {
    return {
      ok: false,
      status: "missing_database_url",
      message: "DATABASE_URL is not configured.",
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      status: "connected",
      message: "Database connection is healthy.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error.";
    return {
      ok: false,
      status: "connection_failed",
      message,
    };
  }
}

export default prisma;