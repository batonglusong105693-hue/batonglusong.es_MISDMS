import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from "@/lib/api-responses";
import {
  generateAttendanceReport,
  calculateAttendancePercentage,
  getAttendanceStatus,
  getQuarterDateRange,
} from "@/lib/attendance-utils";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const quarter = searchParams.get("quarter") || "FIRST"; // FIRST, SECOND, THIRD, FOURTH
  const studentId = searchParams.get("studentId");

  if (!sectionId && !studentId) {
    return badRequestResponse("Either sectionId or studentId is required");
  }

  // Permission check
  if (!hasPermission(session.user.role as Role, "attendance:view")) {
    return forbiddenResponse("Insufficient permissions to view attendance summary", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/attendance/summary",
    });
  }

  // Get enrollments
  const enrollments = await prisma.enrollment.findMany({
    where: {
      ...(sectionId && { sectionId }),
      ...(studentId && { studentId }),
      status: "ENROLLED",
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      section: true,
    },
  });

  if (enrollments.length === 0) {
    return NextResponse.json([]);
  }

  // Get attendance records for quarter
  const enrollmentIds = enrollments.map((e) => e.id);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      enrollmentId: { in: enrollmentIds },
      quarter: quarter as any,
    },
  });

  // Generate summary
  const summaries = generateAttendanceReport(
    records.map((record) => ({
      ...record,
      status: record.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
      quarter: record.quarter as "FIRST" | "SECOND" | "THIRD" | "FOURTH",
      remarks: record.remarks ?? undefined,
      recordedById: record.recordedById ?? undefined,
    })),
    enrollments.map((e) => e.student)
  );

  return NextResponse.json(summaries);
}

// GET /api/attendance/summary/[studentId] - Student's personal attendance
async function getDynamic(
  request: Request,
  { params }: { params: Promise<{ studentId?: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  const { studentId } = await params;
  if (!studentId) {
    return badRequestResponse("studentId is required");
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!student) {
    return notFoundResponse("Student");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId, status: "ENROLLED" },
    include: { section: true },
  });

  if (enrollments.length === 0) {
    return NextResponse.json({
      student,
      summary: { totalDays: 0, presentDays: 0, absentDays: 0, lateDays: 0, attendancePercentage: 0 },
    });
  }

  const enrollmentIds = enrollments.map((e) => e.id);

  // Get all attendance records
  const records = await prisma.attendanceRecord.findMany({
    where: { enrollmentId: { in: enrollmentIds } },
  });

  // Calculate summary by quarter
  const quarters = ["FIRST", "SECOND", "THIRD", "FOURTH"];
  const summaryByQuarter = quarters.map((q) => {
    const quarterRecords = records.filter((r) => r.quarter === q);
    const present = quarterRecords.filter((r) => r.status === "PRESENT").length;
    const absent = quarterRecords.filter((r) => r.status === "ABSENT").length;
    const late = quarterRecords.filter((r) => r.status === "LATE").length;
    const excused = quarterRecords.filter((r) => r.status === "EXCUSED").length;
    const total = present + absent + late + excused;

    const percentage = calculateAttendancePercentage(present, absent, late, excused);
    const status = getAttendanceStatus(percentage);

    return {
      quarter: q,
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      excusedDays: excused,
      attendancePercentage: percentage,
      status,
    };
  });

  // Overall attendance
  const present = records.filter((r) => r.status === "PRESENT").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const total = present + absent + late + excused;

  const overallPercentage = calculateAttendancePercentage(present, absent, late, excused);
  const overallStatus = getAttendanceStatus(overallPercentage);

  return NextResponse.json({
    student,
    overall: {
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      excusedDays: excused,
      attendancePercentage: overallPercentage,
      status: overallStatus,
    },
    byQuarter: summaryByQuarter,
  });
}
