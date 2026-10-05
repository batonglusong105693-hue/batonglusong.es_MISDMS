import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";
import { queryAuditLogs, getAuditSummary, getFailedAttempts } from "@/lib/audit-query";
import { parsePaginationParams, getPaginationSkipTake } from "@/lib/pagination";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "audit:view")) {
    return forbiddenResponse("Insufficient permissions to view audit logs", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/audit-logs",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });

  const action = searchParams.get("action");
  const resource = searchParams.get("resource");
  const userId = searchParams.get("userId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const searchTerm = searchParams.get("search");
  const view = searchParams.get("view");

  try {
    // Summary view
    if (view === "summary") {
      const days = parseInt(searchParams.get("days") || "7");
      const summary = await getAuditSummary(days);
      return NextResponse.json(summary);
    }

    // Failed attempts view
    if (view === "failed") {
      const days = parseInt(searchParams.get("days") || "7");
      const failed = await getFailedAttempts(days);
      return NextResponse.json({
        count: failed.length,
        logs: failed,
      });
    }

    // Main logs view
    const result = await queryAuditLogs({
      page,
      pageSize,
      action: action as any,
      resource: resource || undefined,
      userId: userId || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      searchTerm: searchTerm || undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
