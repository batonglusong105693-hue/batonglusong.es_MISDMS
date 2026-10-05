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

  const role = session.user.role as Role;
  const canViewAllSections = hasPermission(role, "section:view");
  const canViewAssignedSections = role === "TEACHER" || role === "ADVISER";
  if (!canViewAllSections && !canViewAssignedSections) {
    return forbiddenResponse("Insufficient permissions to view sections", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/sections",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);
  const where = canViewAllSections
    ? {}
    : role === "TEACHER"
      ? { teachingLoads: { some: { teacherId: session.user.id } } }
      : { adviserId: session.user.id };

  const [sections, totalCount] = await Promise.all([
    prisma.section.findMany({
      skip,
      take,
      where,
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      include: {
        adviser: { select: { name: true } },
        academicYear: { select: { year: true, isCurrent: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.section.count({ where }),
  ]);

  return NextResponse.json(createPaginatedResponse(sections, page, pageSize, totalCount));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "section:manage")) {
    return forbiddenResponse("Insufficient permissions to manage sections", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/sections",
    });
  }

  const body = await request.json();
  const { name, gradeLevel, adviserId } = body;

  if (!name || !gradeLevel) {
    return badRequestResponse("Section name and grade level are required");
  }

  if (adviserId) {
    const adviser = await prisma.user.findUnique({ where: { id: adviserId } });
    if (!adviser) {
      return notFoundResponse("Adviser");
    }
    if (!["TEACHER", "ADVISER"].includes(adviser.role)) {
      return badRequestResponse("A section adviser must have the Teacher or Adviser role");
    }
  }

  const academicYear = await getActiveAcademicYear();

  const existing = await prisma.section.findFirst({
    where: { name, gradeLevel, academicYearId: academicYear.id },
  });
  if (existing) {
    return conflictResponse("Section already exists for this grade level in the current academic year");
  }

  const section = await prisma.section.create({
    data: {
      name,
      gradeLevel,
      adviserId: adviserId || null,
      academicYearId: academicYear.id,
    },
    include: {
      adviser: { select: { name: true } },
      academicYear: { select: { year: true, isCurrent: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json(section, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "section:manage")) {
    return forbiddenResponse("Insufficient permissions to update sections", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/sections",
    });
  }

  const body = await request.json();
  const { id, name, gradeLevel, adviserId } = body;
  const validGradeLevels = ["KINDERGARTEN", "GRADE_1", "GRADE_2", "GRADE_3", "GRADE_4", "GRADE_5", "GRADE_6"];

  if (!id || !name?.trim() || !gradeLevel) {
    return badRequestResponse("Section ID, name, and grade level are required");
  }
  if (!validGradeLevels.includes(gradeLevel)) {
    return badRequestResponse("Invalid grade level");
  }

  const existing = await prisma.section.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse("Section");
  }

  if (adviserId) {
    const adviser = await prisma.user.findUnique({ where: { id: adviserId } });
    if (!adviser) {
      return notFoundResponse("Adviser");
    }
    if (adviser.status !== "ACTIVE" || !["TEACHER", "ADVISER"].includes(adviser.role)) {
      return badRequestResponse("A section adviser must be an active Teacher or Adviser");
    }
  }

  const duplicate = await prisma.section.findFirst({
    where: {
      id: { not: id },
      name: name.trim(),
      gradeLevel,
      academicYearId: existing.academicYearId,
    },
  });
  if (duplicate) {
    return conflictResponse("Section already exists for this grade level in the same academic year");
  }

  const section = await prisma.section.update({
    where: { id },
    data: {
      name: name.trim(),
      gradeLevel,
      adviserId: adviserId || null,
    },
    include: {
      adviser: { select: { name: true } },
      academicYear: { select: { year: true, isCurrent: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return NextResponse.json(section);
}