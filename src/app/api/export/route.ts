import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";

export type ExportFormat = "csv" | "json";
export type ExportResource = "students" | "faculty" | "grades" | "attendance" | "enrollment" | "sections";

type ExportFilters = Record<string, string | number | undefined>;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "export:data")) {
    return forbiddenResponse("Insufficient permissions to export data", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/export",
    });
  }

  const body = await request.json();
  const { resource, format = "csv", filters = {} as ExportFilters } = body as {
    resource?: ExportResource;
    format?: ExportFormat;
    filters?: ExportFilters;
  };

  if (!resource) return badRequestResponse("Resource type is required");
  if (!["csv", "json"].includes(format)) return badRequestResponse("Invalid format");

  try {
    let data: any[] = [];

    switch (resource) {
      case "students":
        data = await prisma.student.findMany({
          where: {
            status: filters.status ? String(filters.status) as any : { not: "DROPPED_OUT" },
            ...(filters.gender ? { gender: String(filters.gender) as any } : {}),
            ...(filters.barangay ? { barangay: String(filters.barangay) } : {}),
          },
          select: { lrn: true, firstName: true, lastName: true, gender: true, birthDate: true, status: true },
        });
        break;

      case "faculty":
        data = await prisma.user.findMany({
          where: {
            status: "ACTIVE",
            role: filters.role ? String(filters.role) as any : { in: ["TEACHER", "ADVISER"] },
            ...(filters.department ? { department: String(filters.department) } : {}),
          },
          select: { name: true, email: true, role: true, department: true },
        });
        break;

      case "grades":
        data = await prisma.grade.findMany({
          include: { enrollment: { select: { student: { select: { lrn: true, firstName: true, lastName: true } } } }, subject: { select: { name: true } } },
        });
        break;

      case "attendance":
        data = await prisma.attendanceRecord.findMany({
          where: {
            ...(filters.startDate || filters.endDate
              ? {
                  date: {
                    ...(filters.startDate ? { gte: new Date(String(filters.startDate)) } : {}),
                    ...(filters.endDate ? { lte: new Date(String(filters.endDate)) } : {}),
                  },
                }
              : {}),
          },
          include: { enrollment: { select: { student: { select: { lrn: true } } } } },
          orderBy: { date: "desc" },
          take: 1000,
        });
        break;

      case "enrollment":
        data = await prisma.enrollment.findMany({
          where: {
            ...(filters.status ? { status: String(filters.status) as any } : {}),
            ...(filters.sectionId ? { sectionId: String(filters.sectionId) } : {}),
            ...(filters.academicYearId ? { academicYearId: String(filters.academicYearId) } : {}),
          },
          include: { student: { select: { lrn: true, firstName: true, lastName: true } }, section: { select: { name: true } } },
        });
        break;

      case "sections":
        data = await prisma.section.findMany({
          where: {
            ...(filters.gradeLevel ? { gradeLevel: String(filters.gradeLevel) as any } : {}),
            ...(filters.academicYearId ? { academicYearId: String(filters.academicYearId) } : {}),
          },
          include: { adviser: { select: { name: true } }, _count: { select: { enrollments: true } } },
        });
        break;
    }

    // Convert to requested format
    let content: string;
    let mimeType: string;
    let filename: string;

    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      mimeType = "application/json";
      filename = `${resource}-${Date.now()}.json`;
    } else {
      // CSV format
      if (data.length === 0) {
        content = "No data to export";
      } else {
        const headers = Object.keys(data[0]);
        const rows = data.map((item) => headers.map((h) => `"${String(item[h] || "").replace(/"/g, '""')}"`).join(","));
        content = [headers.join(","), ...rows].join("\n");
      }
      mimeType = "text/csv";
      filename = `${resource}-${Date.now()}.csv`;
    }

    // Log export in audit
    await prisma.auditLog.create({
      data: {
        action: "EXPORT",
        entityType: "EXPORT",
        entityId: resource,
        details: { resource, count: data.length },
        performedById: session.user.id,
      },
    }).catch(() => {});

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "export:data")) {
    return forbiddenResponse("Insufficient permissions to view exports", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/export",
    });
  }

  try {
    const exports = await prisma.auditLog.findMany({
      where: { action: "EXPORT", performedById: session.user.id },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    return NextResponse.json({ exports });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch exports" }, { status: 500 });
  }
}
