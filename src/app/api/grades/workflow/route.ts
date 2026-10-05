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

  if (!hasPermission(session.user.role as Role, "grades:manage")) {
    return forbiddenResponse("Insufficient permissions to manage grade workflow", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/grades/workflow",
    });
  }

  try {
    const body = await request.json();
    const { action, gradeId, gradeIds, fromStatus, toStatus, remarks, sectionId } = body;

    if (action === "submit") {
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await submitGradeForReview(gradeId, session.user.id, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade submitted for review",
      });
    }

    if (action === "approve") {
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await approveGradeForPosting(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade approved for posting",
      });
    }

    if (action === "reject") {
      if (!gradeId) return badRequestResponse("Grade ID is required");
      if (!remarks) return badRequestResponse("Rejection remarks are required");

      await rejectGrade(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade rejected",
      });
    }

    if (action === "post") {
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await postGrade(gradeId, session.user.id, session.user.role, remarks);
      return NextResponse.json({
        success: true,
        message: "Grade posted",
      });
    }

    if (action === "finalize") {
      if (!gradeId) return badRequestResponse("Grade ID is required");

      await finalizeGrade(gradeId, session.user.id, session.user.role);
      return NextResponse.json({
        success: true,
        message: "Grade finalized",
      });
    }

    if (action === "bulk_update") {
      if (!gradeIds || !Array.isArray(gradeIds)) {
        return badRequestResponse("Grade IDs array is required");
      }
      if (!fromStatus) return badRequestResponse("Current status is required");
      if (!toStatus) return badRequestResponse("Target status is required");

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

  if (!hasPermission(session.user.role as Role, "grades:view")) {
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
          createdBy: g.createdBy.name,
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

  try {
    const body = await request.json();
    const { gradeId } = body;

    if (!gradeId) return badRequestResponse("Grade ID is required");

    const grade = await prisma.grade.findUnique({
      where: { id: gradeId },
      select: { workflowStatus: true },
    });

    const currentStatus = (grade?.workflowStatus as GradeStatus) || "DRAFT";
    const nextSteps = getNextSteps(currentStatus);

    return NextResponse.json({
      gradeId,
      currentStatus,
      availableTransitions: nextSteps,
      canTransition: (targetStatus: string) =>
        canTransitionTo(currentStatus, targetStatus as GradeStatus),
    });
  } catch (err) {
    console.error("Grade workflow check error:", err);
    return NextResponse.json(
      { error: "Failed to check workflow status" },
      { status: 500 }
    );
  }
}
