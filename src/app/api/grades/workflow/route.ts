import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  submitGradeForReview,
  approveGradeForPosting,
  rejectGrade,
  postGrade,
  finalizeGrade,
  getGradeWorkflowHistory,
  getGradesPendingReview,
  bulkUpdateGradeStatus,
  canTransitionTo,
  getNextSteps,
  type GradeStatus,
} from "@/lib/grade-workflow";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse } from "@/lib/api-responses";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const role = session.user.role as Role;
  if (
    !hasPermission(role, "grade:manage") &&
    !hasPermission(role, "grade:workflow")
  ) {
    return forbiddenResponse("Insufficient permissions to manage grade workflow", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/grades/workflow",
    });
  }

  try {
    const body = await request.json();
    const { action, gradeId, gradeIds, fromStatus, toStatus, remarks } = body;

    if (action === "submit") {
      if (!["TEACHER", "ADVISER"].includes(role)) {
        return forbiddenResponse("Only assigned teaching staff can submit grades", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeId) return badRequestResponse("Grade ID is required");

      const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        select: { subjectId: true, enrollment: { select: { sectionId: true } } },
      });
      if (!grade) return badRequestResponse("Grade not found");

      const assignment = role === "TEACHER"
        ? await prisma.teachingLoad.findUnique({
            where: {
              teacherId_sectionId_subjectId: {
                teacherId: session.user.id,
                sectionId: grade.enrollment.sectionId ?? "",
                subjectId: grade.subjectId,
              },
            },
            select: { id: true },
          })
        : await prisma.section.findFirst({
            where: {
              id: grade.enrollment.sectionId ?? "",
              adviserId: session.user.id,
            },
            select: { id: true },
          });
      if (!assignment) {
        return forbiddenResponse("You are not assigned to this grade", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }

      await submitGradeForReview(gradeId, session.user.id, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade submitted for review",
      });
    }

    if (action === "approve") {
      if (!hasPermission(role, "grade:workflow")) {
        return forbiddenResponse("Insufficient permissions to approve grades", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await approveGradeForPosting(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade approved for posting",
      });
    }

    if (action === "reject") {
      if (!hasPermission(role, "grade:workflow")) {
        return forbiddenResponse("Insufficient permissions to reject grades", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeId) return badRequestResponse("Grade ID is required");
      if (!remarks) return badRequestResponse("Rejection remarks are required");

      await rejectGrade(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade rejected",
      });
    }

    if (action === "post") {
      if (!hasPermission(role, "grade:workflow")) {
        return forbiddenResponse("Insufficient permissions to post grades", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await postGrade(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade posted",
      });
    }

    if (action === "finalize") {
      if (!hasPermission(role, "grade:workflow")) {
        return forbiddenResponse("Insufficient permissions to finalize grades", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await finalizeGrade(gradeId, session.user.id, session.user.role);
      return NextResponse.json({
        success: true,
        message: "Grade finalized",
      });
    }

    if (action === "bulk_update") {
      if (
        !hasPermission(role, "grade:workflow") ||
        !["PRINCIPAL", "SUPER_ADMIN"].includes(role)
      ) {
        return forbiddenResponse("Only the principal can approve grades in bulk", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/grades/workflow",
        });
      }
      if (!gradeIds || !Array.isArray(gradeIds)) {
        return badRequestResponse("Grade IDs array is required");
      }
      if (fromStatus !== "UNDER_REVIEW" || toStatus !== "APPROVED") {
        return badRequestResponse("Bulk workflow action only supports approving grades under review");
      }

      const validFromStatus = fromStatus as GradeStatus;
      const validToStatus = toStatus as GradeStatus;
      if (!canTransitionTo(validFromStatus, validToStatus)) {
        return badRequestResponse(`Invalid workflow transition from ${validFromStatus} to ${validToStatus}`);
      }

      const result = await bulkUpdateGradeStatus(
        gradeIds,
        validFromStatus,
        validToStatus,
        session.user.id,
        remarks
      );

      return NextResponse.json({
        success: true,
        result,
      });
    }

    return badRequestResponse("Invalid action");
  } catch (err) {
    console.error("Grade workflow error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Workflow action failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "grade:workflow")) {
    return forbiddenResponse("Insufficient permissions to view grades", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/grades/workflow",
    });
  }

  const { searchParams } = new URL(request.url);
  const gradeId = searchParams.get("gradeId");
  const sectionId = searchParams.get("sectionId");
  const status = searchParams.get("status");

  try {
    if (gradeId) {
      const grade = await prisma.grade.findUnique({
        where: { id: gradeId },
        select: { id: true, enrollment: { select: { sectionId: true } }, subjectId: true },
      });
      if (!grade) return badRequestResponse("Grade not found");

      if (["TEACHER", "ADVISER"].includes(session.user.role)) {
        const assigned = session.user.role === "TEACHER"
          ? await prisma.teachingLoad.findUnique({
              where: {
                teacherId_sectionId_subjectId: {
                  teacherId: session.user.id,
                  sectionId: grade.enrollment.sectionId ?? "",
                  subjectId: grade.subjectId,
                },
              },
              select: { id: true },
            })
          : await prisma.section.findFirst({
              where: {
                id: grade.enrollment.sectionId ?? "",
                adviserId: session.user.id,
              },
              select: { id: true },
            });
        if (!assigned) {
          return forbiddenResponse("You are not assigned to this grade", {
            userId: session.user.id,
            action: "GET",
            resource: "/api/grades/workflow",
          });
        }
      }

      // Get workflow history for a specific grade
      const history = await getGradeWorkflowHistory(gradeId);

      return NextResponse.json({
        gradeId,
        history: history.map((h) => ({
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
          action: h.action,
          performedBy: h.performedBy,
          performedByRole: h.performedByRole,
          remarks: h.remarks,
          timestamp: h.timestamp,
        })),
      });
    }

    if (sectionId && status) {
      const validStatuses: GradeStatus[] = [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "POSTED",
        "FINALIZED",
      ];
      if (!validStatuses.includes(status as GradeStatus)) {
        return badRequestResponse("Invalid grade workflow status");
      }

      if (["TEACHER", "ADVISER"].includes(session.user.role)) {
        const assignedSection = session.user.role === "TEACHER"
          ? await prisma.teachingLoad.findFirst({
              where: { teacherId: session.user.id, sectionId },
              select: { id: true },
            })
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
        if (!assignedSection) {
          return forbiddenResponse("Not assigned to this section", {
            userId: session.user.id,
            action: "GET",
            resource: "/api/grades/workflow",
          });
        }
      }

      // Get grades pending review
      const grades = await getGradesPendingReview(sectionId, status as GradeStatus);

      return NextResponse.json({
        sectionId,
        status,
        count: grades.length,
        grades: grades.map((g) => ({
          id: g.id,
          student: `${g.enrollment.student.firstName} ${g.enrollment.student.lastName}`,
          lrn: g.enrollment.student.lrn,
          subject: g.subject.name,
          status: g.workflowStatus,
          createdBy: g.createdBy?.name ?? "Unknown",
          createdAt: g.createdAt,
        })),
      });
    }

    return badRequestResponse("Grade ID or (section ID + status) is required");
  } catch (err) {
    console.error("Grade workflow retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve workflow data" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();
  if (!hasPermission(session.user.role as Role, "grade:workflow")) {
    return forbiddenResponse("Insufficient permissions to view grade workflow status", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/grades/workflow",
    });
  }

  try {
    const body = await request.json();
    const { gradeId } = body;

    if (!gradeId) return badRequestResponse("Grade ID is required");

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { workflowStatus: true },
    });
    if (!grade) return badRequestResponse("Grade not found");

    const currentStatus = grade.workflowStatus as GradeStatus;
    const nextSteps = getNextSteps(currentStatus);

    return NextResponse.json({
      gradeId,
      currentStatus,
      availableTransitions: nextSteps,
    });
  } catch (err) {
    console.error("Grade workflow check error:", err);
    return NextResponse.json(
      { error: "Failed to check workflow status" },
      { status: 500 }
    );
  }
}
