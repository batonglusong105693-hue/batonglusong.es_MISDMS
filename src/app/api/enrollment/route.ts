import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-responses";
import { parsePaginationParams, getPaginationSkipTake, createPaginatedResponse } from "@/lib/pagination";
import { getActiveAcademicYear } from "@/lib/academic-year";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const role = session.user.role as Role;

  if (sectionId && (role === "TEACHER" || role === "ADVISER")) {
    const assignment = role === "TEACHER"
      ? await prisma.teachingLoad.findFirst({ where: { teacherId: session.user.id, sectionId } })
      : await prisma.section.findFirst({
          where: {
            id: sectionId,
            OR: [
              { adviserId: session.user.id },
              { teachingLoads: { some: { teacherId: session.user.id } } },
            ],
          },
          select: { id: true },
        });
    if (!assignment) {
      return forbiddenResponse("Not assigned to this section", {
        userId: session.user.id,
        action: "GET",
        resource: "/api/enrollment",
      });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId, status: "ENROLLED" },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      include: {
        student: { select: { id: true, lrn: true, firstName: true, lastName: true } },
      },
    });
    return NextResponse.json(enrollments);
  }

  if (!hasPermission(role, "enrollment:view")) {
    return forbiddenResponse("Insufficient permissions to view enrollments", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/enrollment",
    });
  }

  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);

  const [enrollments, totalCount] = await Promise.all([
    prisma.enrollment.findMany({
      skip,
      take,
      orderBy: [{ createdAt: "desc" }],
      include: {
        student: { select: { lrn: true, firstName: true, lastName: true } },
        section: { select: { name: true, gradeLevel: true } },
        academicYear: { select: { year: true } },
      },
    }),
    prisma.enrollment.count(),
  ]);

  return NextResponse.json(createPaginatedResponse(enrollments, page, pageSize, totalCount));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "enrollment:manage")) {
    return forbiddenResponse("Insufficient permissions to manage enrollments", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/enrollment",
    });
  }

  const body = await request.json();
  const { studentId, sectionId } = body;

  if (!studentId || !sectionId) {
    return badRequestResponse("Student ID and section ID are required");
  }

  const academicYear = await getActiveAcademicYear();

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return notFoundResponse("Student");
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return notFoundResponse("Section");
  }

  const enrollmentCount = await prisma.enrollment.count({
    where: { sectionId, status: "ENROLLED" },
  });

  if (enrollmentCount >= section.capacity) {
    return conflictResponse(`Section is at capacity (${section.capacity} students)`);
  }

  const existing = await prisma.enrollment.findFirst({
    where: { studentId, academicYearId: academicYear.id },
  });
  if (existing) {
    return conflictResponse("Student is already enrolled in this academic year");
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      studentId,
      sectionId,
      academicYearId: academicYear.id,
      status: "ENROLLED",
      createdById: session.user.id,
    },
    include: {
      student: { select: { lrn: true, firstName: true, lastName: true } },
      section: { select: { name: true, gradeLevel: true } },
      academicYear: { select: { year: true } },
    },
  });

  return NextResponse.json(enrollment, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "enrollment:manage")) {
    return forbiddenResponse("Insufficient permissions to update enrollments", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/enrollment",
    });
  }

  const body = await request.json();
  const { id, sectionId } = body;
  if (!id || !sectionId) {
    return badRequestResponse("Enrollment ID and section ID are required");
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { id },
    include: { _count: { select: { grades: true, attendanceRecords: true } } },
  });
  if (!enrollment) {
    return notFoundResponse("Enrollment");
  }
  if (enrollment.status !== "ENROLLED") {
    return badRequestResponse("Only active enrollments can be reassigned");
  }
  if (enrollment.sectionId === sectionId) {
    return NextResponse.json(enrollment);
  }
  if (enrollment._count.grades > 0 || enrollment._count.attendanceRecords > 0) {
    return conflictResponse("This enrollment has grade or attendance history and cannot be reassigned");
  }

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return notFoundResponse("Section");
  }
  if (section.academicYearId !== enrollment.academicYearId) {
    return badRequestResponse("The destination section must belong to the same academic year");
  }

  const enrollmentCount = await prisma.enrollment.count({
    where: { sectionId, status: "ENROLLED" },
  });
  if (enrollmentCount >= section.capacity) {
    return conflictResponse(`Section is at capacity (${section.capacity} students)`);
  }

  const updated = await prisma.enrollment.update({
    where: { id },
    data: { sectionId },
    include: {
      student: { select: { lrn: true, firstName: true, lastName: true } },
      section: { select: { name: true, gradeLevel: true } },
      academicYear: { select: { year: true } },
    },
  });

  return NextResponse.json(updated);
}