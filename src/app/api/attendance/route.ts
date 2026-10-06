import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from "@/lib/api-responses";
import { getCurrentQuarter, formatDateForAPI } from "@/lib/attendance-utils";

async function canAccessAssignedSection(userId: string, role: string, sectionId: string) {
  if (role === "TEACHER") {
    return Boolean(await prisma.teachingLoad.findFirst({ where: { teacherId: userId, sectionId } }));
  }
  if (role === "ADVISER") {
    return Boolean(await prisma.section.findFirst({
      where: {
        id: sectionId,
        OR: [
          { adviserId: userId },
          { teachingLoads: { some: { teacherId: userId } } },
        ],
      },
      select: { id: true },
    }));
  }
  return true;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const date = searchParams.get("date"); // YYYY-MM-DD
  const quarter = searchParams.get("quarter"); // FIRST, SECOND, etc

  if (!sectionId) {
    return badRequestResponse("sectionId is required");
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return notFoundResponse("Section");
  }

  // Check permission
  if (session.user.role === "TEACHER" || session.user.role === "ADVISER") {
    if (!await canAccessAssignedSection(session.user.id, session.user.role, sectionId)) {
      return forbiddenResponse("Not assigned to this section", {
        userId: session.user.id,
        action: "GET",
        resource: `/api/attendance?sectionId=${sectionId}`,
      });
    }
  } else if (!hasPermission(session.user.role as Role, "attendance:view")) {
    return forbiddenResponse("Insufficient permissions to view attendance", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/attendance",
    });
  }

  // Build where clause
  const where: any = { enrollment: { sectionId } };

  if (date) {
    const dateObj = new Date(date);
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    where.date = { gte: dateObj, lt: nextDay };
  }

  if (quarter) {
    where.quarter = quarter;
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      student: { select: { id: true, lrn: true, firstName: true, lastName: true } },
      enrollment: { select: { id: true, sectionId: true } },
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { student: { lastName: "asc" } }],
    take: 500,
  });

  return NextResponse.json(records);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "attendance:manage")) {
    return forbiddenResponse("Insufficient permissions to record attendance", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/attendance",
    });
  }

  const body = await request.json();
  const { sectionId, date, records } = body;

  if (!sectionId || !date || !Array.isArray(records)) {
    return badRequestResponse("sectionId, date, and records array are required");
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return notFoundResponse("Section");
  }

  if (session.user.role === "TEACHER" || session.user.role === "ADVISER") {
    if (!await canAccessAssignedSection(session.user.id, session.user.role, sectionId)) {
      return forbiddenResponse("Not assigned to this section", {
        userId: session.user.id,
        action: "POST",
        resource: "/api/attendance",
      });
    }
  }

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) {
    return badRequestResponse("Invalid date format (use YYYY-MM-DD)");
  }

  const quarter = getCurrentQuarter(dateObj);

  // Validate records
  const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
  for (const record of records) {
    if (!record.enrollmentId || !validStatuses.includes(record.status)) {
      return badRequestResponse(`Invalid record: enrollmentId and status (${validStatuses.join(", ")}) required`);
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: record.enrollmentId },
      include: { section: true },
    });

    if (!enrollment || enrollment.section?.id !== sectionId) {
      return badRequestResponse(`Enrollment ${record.enrollmentId} not found in section`);
    }

    record.studentId = enrollment.studentId;
  }

  // Create or update attendance records
  const createdRecords = await prisma.$transaction(async (transaction) => {
    const saved = await Promise.all(
      records.map((record: any) =>
        transaction.attendanceRecord.upsert({
        where: {
          enrollmentId_date_quarter: {
            enrollmentId: record.enrollmentId,
            date: dateObj,
            quarter,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks || null,
          recordedById: session.user.id,
        },
        create: {
          studentId: record.studentId,
          enrollmentId: record.enrollmentId,
          date: dateObj,
          status: record.status,
          quarter,
          remarks: record.remarks || null,
          recordedById: session.user.id,
        },
        include: {
          student: { select: { lrn: true, firstName: true, lastName: true } },
          recordedBy: { select: { name: true } },
        },
        })
      )
    );
    await transaction.auditLog.create({
      data: {
        action: "ATTENDANCE_RECORDED",
        entityType: "ATTENDANCE",
        entityId: sectionId,
        performedById: session.user.id,
        details: { date: dateObj.toISOString(), count: saved.length },
      },
    });
    return saved;
  });

  return NextResponse.json(
    { success: true, count: createdRecords.length, records: createdRecords },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "attendance:manage")) {
    return forbiddenResponse("Insufficient permissions to update attendance", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/attendance",
    });
  }

  const body = await request.json();
  const { id, status, remarks } = body;

  if (!id || !status) {
    return badRequestResponse("id and status are required");
  }

  const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
  if (!validStatuses.includes(status)) {
    return badRequestResponse(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const record = await prisma.attendanceRecord.findUnique({
    where: { id },
    include: { enrollment: { select: { sectionId: true } } },
  });
  if (!record) {
    return notFoundResponse("Attendance record");
  }

  if (session.user.role === "TEACHER" || session.user.role === "ADVISER") {
    const sectionId = record.enrollment.sectionId;
    if (!sectionId || !await canAccessAssignedSection(session.user.id, session.user.role, sectionId)) {
      return forbiddenResponse("Not assigned to this section", {
        userId: session.user.id,
        action: "PATCH",
        resource: "/api/attendance",
      });
    }
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.attendanceRecord.update({
      where: { id },
      data: {
        status,
        remarks: remarks || null,
        recordedById: session.user.id,
      },
      include: {
        student: { select: { lrn: true, firstName: true, lastName: true } },
        recordedBy: { select: { name: true } },
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "ATTENDANCE_UPDATED",
        entityType: "ATTENDANCE",
        entityId: id,
        performedById: session.user.id,
        details: { status },
      },
    });
    return saved;
  });

  return NextResponse.json(updated);
}
