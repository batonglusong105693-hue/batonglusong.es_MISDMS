import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-responses";
import { parsePaginationParams, getPaginationSkipTake, createPaginatedResponse } from "@/lib/pagination";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "grade:view")) {
    return forbiddenResponse("Insufficient permissions to view grades", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/grades",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);
  const role = session.user.role as Role;
  let where: Record<string, unknown> = {};

  if (role === "TEACHER") {
    const teachingLoads = await prisma.teachingLoad.findMany({
      where: { teacherId: session.user.id },
      select: { sectionId: true, subjectId: true },
    });
    where = teachingLoads.length
      ? {
          OR: teachingLoads.map(({ sectionId, subjectId }) => ({
            subjectId,
            enrollment: { sectionId },
          })),
        }
      : { id: "__no_assigned_grades__" };
  } else if (role === "ADVISER") {
    const sections = await prisma.section.findMany({
      where: {
        OR: [
          { adviserId: session.user.id },
          { teachingLoads: { some: { teacherId: session.user.id } } },
        ],
      },
      select: { id: true },
    });
    where = { enrollment: { sectionId: { in: sections.map(({ id }) => id) } } };
  }

  const [grades, totalCount] = await Promise.all([
    prisma.grade.findMany({
      skip,
      take,
      where,
      include: {
        enrollment: {
          select: {
            id: true,
            sectionId: true,
            student: { select: { lrn: true, firstName: true, lastName: true } },
            section: { select: { name: true, gradeLevel: true } },
          },
        },
        subject: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.grade.count({ where }),
  ]);

  const teacherLoads = role === "TEACHER"
    ? await prisma.teachingLoad.findMany({
        where: { teacherId: session.user.id },
        select: { sectionId: true, subjectId: true },
      })
    : [];
  const teacherLoadKeys = new Set(teacherLoads.map((load) => `${load.sectionId}:${load.subjectId}`));
  const gradesWithEditPermission = grades.map((grade) => ({
    ...grade,
    canEdit: hasPermission(role, "grade:manage") && (
      role === "SUPER_ADMIN" ||
      (role === "TEACHER" && teacherLoadKeys.has(`${grade.enrollment.sectionId}:${grade.subject.id}`)) ||
      (role === "ADVISER" && grade.enrollment.sectionId !== null)
    ) && !grade.locked && ["DRAFT", "REJECTED"].includes(grade.workflowStatus),
  }));

  return NextResponse.json(createPaginatedResponse(gradesWithEditPermission, page, pageSize, totalCount));
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "grade:manage")) {
    return forbiddenResponse("Insufficient permissions to manage grades", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/grades",
    });
  }

  const body = await request.json();
  const { id, field, value } = body;

  const allowedFields = [
    "q1WrittenWork", "q1PerformanceTask", "q1PeriodicTest",
    "q2WrittenWork", "q2PerformanceTask", "q2PeriodicTest",
    "q3WrittenWork", "q3PerformanceTask", "q3PeriodicTest",
    "q4WrittenWork", "q4PerformanceTask", "q4PeriodicTest",
  ];

  if (!id || !allowedFields.includes(field)) {
    return badRequestResponse("Invalid request: id and valid field are required");
  }

  const grade = await prisma.grade.findUnique({
    where: { id },
    include: {
      enrollment: { select: { sectionId: true } },
      subject: true,
    },
  });

  if (!grade) {
    return notFoundResponse("Grade");
  }

  if (grade.locked || !["DRAFT", "REJECTED"].includes(grade.workflowStatus)) {
    return badRequestResponse("Grades can only be changed while they are draft or rejected and unlocked");
  }

  if (session.user.role === "TEACHER" || session.user.role === "ADVISER") {
    const hasTeachingLoad = await prisma.teachingLoad.findUnique({
      where: {
        teacherId_sectionId_subjectId: {
          teacherId: session.user.id,
          sectionId: grade.enrollment.sectionId ?? "",
          subjectId: grade.subject.id,
        },
      },
    });

    const isAdviser = session.user.role === "ADVISER" && grade.enrollment.sectionId
      ? await prisma.section.findFirst({
          where: { id: grade.enrollment.sectionId, adviserId: session.user.id },
          select: { id: true },
        })
      : null;

    if (!hasTeachingLoad && !isAdviser) {
      return forbiddenResponse("Not assigned to teach this section/subject", {
        userId: session.user.id,
        action: "PATCH",
        resource: `/api/grades/${id}`,
      });
    }
  }

  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100)) {
    return badRequestResponse("Grade values must be numbers between 0 and 100");
  }
  const num = value;

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const changed = await tx.grade.updateMany({
        where: {
          id,
          workflowStatus: grade.workflowStatus,
          locked: false,
          updatedAt: grade.updatedAt,
        },
        data: { [field]: num },
      });
      if (changed.count !== 1) {
        throw new Error("Grade changed while saving; refresh and try again");
      }
      const updated = await tx.grade.findUniqueOrThrow({ where: { id } });

      const q = field.substring(0, 2);
      const ww = updated[`${q}WrittenWork` as keyof typeof updated] as number | null;
      const pt = updated[`${q}PerformanceTask` as keyof typeof updated] as number | null;
      const pe = updated[`${q}PeriodicTest` as keyof typeof updated] as number | null;

      let qGrade: number | null = null;
      if (ww !== null && pt !== null && pe !== null) {
        qGrade = Math.round((ww * 0.3 + pt * 0.5 + pe * 0.2) * 100) / 100;
      }

      const refreshed = await tx.grade.update({
        where: { id },
        data: {
          [`${q}Grade`]: qGrade,
        },
      });

      const q1 = refreshed.q1Grade;
      const q2 = refreshed.q2Grade;
      const q3 = refreshed.q3Grade;
      const q4 = refreshed.q4Grade;
      const quarters = [q1, q2, q3, q4].filter((v) => v !== null) as number[];
      const final = quarters.length
        ? Math.round((quarters.reduce((a, b) => a + b, 0) / quarters.length) * 100) / 100
        : null;
      const remarks = final !== null ? (final >= 75 ? "PASSED" : "FAILED") : null;

      const finalResult = await tx.grade.update({
        where: { id },
        data: { finalGrade: final, remarks },
      });
      await tx.auditLog.create({
        data: {
          action: "GRADE_UPDATED",
          entityType: "GRADE",
          entityId: id,
          performedById: session.user.id,
          details: { field, value: num, workflowStatus: grade.workflowStatus },
        },
      });

      return finalResult;
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Grade changed while saving")) {
      return conflictResponse(error.message);
    }
    throw error;
  }

  return NextResponse.json(result);
}