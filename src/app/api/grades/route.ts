import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from "@/lib/api-responses";
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

  const [grades, totalCount] = await Promise.all([
    prisma.grade.findMany({
      skip,
      take,
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
    prisma.grade.count(),
  ]);

  const role = session.user.role as Role;
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
      role !== "TEACHER" || teacherLoadKeys.has(`${grade.enrollment.sectionId}:${grade.subject.id}`)
    ),
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

  if (session.user.role === "TEACHER") {
    const hasTeachingLoad = await prisma.teachingLoad.findUnique({
      where: {
        teacherId_sectionId_subjectId: {
          teacherId: session.user.id,
          sectionId: grade.enrollment.sectionId!,
          subjectId: grade.subject.id,
        },
      },
    });

    if (!hasTeachingLoad) {
      return forbiddenResponse("Not assigned to teach this section/subject", {
        userId: session.user.id,
        action: "PATCH",
        resource: `/api/grades/${id}`,
      });
    }
  }

  const num = value === null ? null : Math.max(0, Math.min(100, Number(value)));

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.update({
      where: { id },
      data: { [field]: num },
    });

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
      data: { finalGrade: final, remarks, submittedById: session.user.id, submittedAt: new Date() },
    });

    return finalResult;
  });

  return NextResponse.json(result);
}