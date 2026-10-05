import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse } from "@/lib/api-responses";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(session.user.role as Role, "document:view")) {
    return forbiddenResponse("Insufficient permissions to view released documents", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/documents/released",
    });
  }

  const logs = await prisma.documentReleaseLog.findMany({
    orderBy: { dateReleased: "desc" },
    take: 50,
    include: {
      document: {
        select: { title: true, referenceNumber: true, isConfidential: true },
      },
    },
  });

  return NextResponse.json(logs.filter((log) => !log.document.isConfidential));
}