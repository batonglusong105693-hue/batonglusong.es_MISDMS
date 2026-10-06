import { prisma } from "./prisma";

export type GradeStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "POSTED" | "FINALIZED";

export interface GradeWorkflowStep {
  step: number;
  status: GradeStatus;
  description: string;
  actor: string;
  allowedRoles: string[];
  nextSteps: GradeStatus[];
}

export interface GradeWorkflowAction {
  id: string;
  gradeId: string;
  fromStatus: GradeStatus;
  toStatus: GradeStatus;
  action: string;
  performedBy: string;
  performedByRole: string;
  remarks?: string;
  timestamp: Date;
}

const GRADE_WORKFLOW: Record<GradeStatus, GradeWorkflowStep> = {
  DRAFT: {
    step: 1,
    status: "DRAFT",
    description: "Grade is being entered",
    actor: "Teacher",
    allowedRoles: ["TEACHER"],
    nextSteps: ["SUBMITTED", "DRAFT"],
  },
  SUBMITTED: {
    step: 2,
    status: "SUBMITTED",
    description: "Grade submitted for review",
    actor: "Administrative Officer",
    allowedRoles: ["ADMIN_OFFICER", "PRINCIPAL"],
    nextSteps: ["UNDER_REVIEW", "REJECTED"],
  },
  UNDER_REVIEW: {
    step: 3,
    status: "UNDER_REVIEW",
    description: "Grade is being reviewed",
    actor: "Administrative Officer",
    allowedRoles: ["ADMIN_OFFICER"],
    nextSteps: ["APPROVED", "REJECTED"],
  },
  APPROVED: {
    step: 4,
    status: "APPROVED",
    description: "Grade approved for posting",
    actor: "Principal",
    allowedRoles: ["PRINCIPAL"],
    nextSteps: ["POSTED", "REJECTED"],
  },
  REJECTED: {
    step: 0,
    status: "REJECTED",
    description: "Grade rejected - needs correction",
    actor: "Teacher",
    allowedRoles: ["TEACHER"],
    nextSteps: ["DRAFT", "SUBMITTED"],
  },
  POSTED: {
    step: 5,
    status: "POSTED",
    description: "Grade posted to student records",
    actor: "Administrative Officer",
    allowedRoles: ["ADMIN_OFFICER", "PRINCIPAL"],
    nextSteps: ["FINALIZED"],
  },
  FINALIZED: {
    step: 6,
    status: "FINALIZED",
    description: "Grade is finalized and locked",
    actor: "Principal",
    allowedRoles: ["PRINCIPAL", "SUPER_ADMIN"],
    nextSteps: [],
  },
};

export async function initializeGradeWorkflow(gradeId: string): Promise<void> {
  await prisma.grade.update({
    where: { id: gradeId },
    data: {
      workflowStatus: "DRAFT",
      updatedAt: new Date(),
    },
  });
}

export async function submitGradeForReview(
  gradeId: string,
  userId: string,
  remarks?: string
): Promise<void> {
  const grade = await prisma.grade.findUnique({
    where: { id: gradeId },
    include: { createdBy: true },
  });

  if (!grade) throw new Error("Grade not found");
  if (grade.workflowStatus !== "DRAFT" && grade.workflowStatus !== "REJECTED") {
    throw new Error(`Cannot submit grade from ${grade.workflowStatus} status`);
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.updateMany({
      where: { id: gradeId, workflowStatus: grade.workflowStatus, locked: false },
      data: {
        workflowStatus: "SUBMITTED",
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Grade status changed; refresh and try again");

    await tx.gradeWorkflowLog.create({
      data: {
        gradeId,
        fromStatus: grade.workflowStatus as GradeStatus,
        toStatus: "SUBMITTED",
        action: "SUBMITTED_FOR_REVIEW",
        performedBy: userId,
        remarks,
      },
    });
  });
}

export async function approveGradeForPosting(
  gradeId: string,
  userId: string,
  userRole: string,
  remarks?: string
): Promise<void> {
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

  if (!grade) throw new Error("Grade not found");
  if (grade.workflowStatus !== "UNDER_REVIEW") {
    throw new Error(`Cannot approve grade from ${grade.workflowStatus} status`);
  }

  const allowedRoles = GRADE_WORKFLOW.APPROVED.allowedRoles;
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Insufficient permissions to approve grades");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.updateMany({
      where: { id: gradeId, workflowStatus: "UNDER_REVIEW", locked: false },
      data: {
        workflowStatus: "APPROVED",
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Grade status changed; refresh and try again");

    await tx.gradeWorkflowLog.create({
      data: {
        gradeId,
        fromStatus: "UNDER_REVIEW",
        toStatus: "APPROVED",
        action: "APPROVED",
        performedBy: userId,
        remarks,
      },
    });
  });
}

export async function rejectGrade(
  gradeId: string,
  userId: string,
  userRole: string,
  remarks: string
): Promise<void> {
  if (!remarks || remarks.trim().length === 0) {
    throw new Error("Rejection remarks are required");
  }

  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

  if (!grade) throw new Error("Grade not found");

  const rejectableStatuses = ["SUBMITTED", "UNDER_REVIEW", "APPROVED"];
  if (!rejectableStatuses.includes(grade.workflowStatus)) {
    throw new Error(`Cannot reject grade from ${grade.workflowStatus} status`);
  }
  const allowedRoles = grade.workflowStatus === "APPROVED"
    ? ["PRINCIPAL"]
    : ["ADMIN_OFFICER", "PRINCIPAL"];
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Insufficient permissions to reject grades");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.updateMany({
      where: { id: gradeId, workflowStatus: grade.workflowStatus, locked: false },
      data: {
        workflowStatus: "REJECTED",
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Grade status changed; refresh and try again");

    await tx.gradeWorkflowLog.create({
      data: {
        gradeId,
        fromStatus: grade.workflowStatus as GradeStatus,
        toStatus: "REJECTED",
        action: "REJECTED",
        performedBy: userId,
        remarks,
      },
    });
  });
}

export async function postGrade(
  gradeId: string,
  userId: string,
  userRole: string,
  remarks?: string
): Promise<void> {
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

  if (!grade) throw new Error("Grade not found");
  if (grade.workflowStatus !== "APPROVED") {
    throw new Error(`Cannot post grade from ${grade.workflowStatus} status`);
  }

  const allowedRoles = GRADE_WORKFLOW.POSTED.allowedRoles;
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Insufficient permissions to post grades");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.updateMany({
      where: { id: gradeId, workflowStatus: "APPROVED", locked: false },
      data: {
        workflowStatus: "POSTED",
        postedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Grade status changed; refresh and try again");

    await tx.gradeWorkflowLog.create({
      data: {
        gradeId,
        fromStatus: "APPROVED",
        toStatus: "POSTED",
        action: "POSTED",
        performedBy: userId,
        remarks,
      },
    });
  });
}

export async function finalizeGrade(
  gradeId: string,
  userId: string,
  userRole: string
): Promise<void> {
  const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

  if (!grade) throw new Error("Grade not found");
  if (grade.workflowStatus !== "POSTED") {
    throw new Error(`Cannot finalize grade from ${grade.workflowStatus} status`);
  }

  const allowedRoles = GRADE_WORKFLOW.FINALIZED.allowedRoles;
  if (!allowedRoles.includes(userRole)) {
    throw new Error("Insufficient permissions to finalize grades");
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.grade.updateMany({
      where: { id: gradeId, workflowStatus: "POSTED", locked: false },
      data: {
        workflowStatus: "FINALIZED",
        finalizedAt: new Date(),
        locked: true,
        updatedAt: new Date(),
      },
    });
    if (updated.count !== 1) throw new Error("Grade status changed; refresh and try again");

    await tx.gradeWorkflowLog.create({
      data: {
        gradeId,
        fromStatus: "POSTED",
        toStatus: "FINALIZED",
        action: "FINALIZED",
        performedBy: userId,
      },
    });
  });
}

export async function getGradeWorkflowHistory(gradeId: string): Promise<GradeWorkflowAction[]> {
  const logs = await prisma.gradeWorkflowLog.findMany({
    where: { gradeId },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return logs.map((log) => ({
    id: log.id,
    gradeId: log.gradeId,
    fromStatus: log.fromStatus as GradeStatus,
    toStatus: log.toStatus as GradeStatus,
    action: log.action,
    performedBy: log.actor?.name || log.performedBy || "Unknown User",
    performedByRole: log.actor?.role || "UNKNOWN",
    remarks: log.remarks || undefined,
    timestamp: log.createdAt,
  }));
}

export async function getGradesPendingReview(
  sectionId: string,
  status: GradeStatus
): Promise<any[]> {
  return await prisma.grade.findMany({
    where: {
      workflowStatus: status,
      enrollment: {
        section: { id: sectionId },
      },
    },
    include: {
      enrollment: {
        select: {
          student: {
            select: { firstName: true, lastName: true, lrn: true },
          },
        },
      },
      subject: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function bulkUpdateGradeStatus(
  gradeIds: string[],
  fromStatus: GradeStatus,
  toStatus: GradeStatus,
  userId: string,
  remarks?: string
): Promise<{ success: number; failed: number }> {
  if (!canTransitionTo(fromStatus, toStatus)) {
    throw new Error(`Invalid workflow transition from ${fromStatus} to ${toStatus}`);
  }

  let success = 0;
  let failed = 0;

  for (const gradeId of gradeIds) {
    try {
      const grade = await prisma.grade.findUnique({ where: { id: gradeId } });

      if (!grade) {
        failed++;
        continue;
      }

      if (grade.workflowStatus !== fromStatus) {
        failed++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const updated = await tx.grade.updateMany({
          where: { id: gradeId, workflowStatus: fromStatus, locked: false },
          data: {
            workflowStatus: toStatus,
            ...(toStatus === "FINALIZED" ? { finalizedAt: new Date(), locked: true } : {}),
            updatedAt: new Date(),
          },
        });
        if (updated.count !== 1) throw new Error("Grade status changed");

        await tx.gradeWorkflowLog.create({
          data: {
            gradeId,
            fromStatus,
            toStatus,
            action: toStatus,
            performedBy: userId,
            remarks,
          },
        });
      });

      success++;
    } catch (err) {
      failed++;
    }
  }

  return { success, failed };
}

export function canTransitionTo(currentStatus: GradeStatus, targetStatus: GradeStatus): boolean {
  if (currentStatus === targetStatus) return false;
  const workflow = GRADE_WORKFLOW[currentStatus];
  return workflow?.nextSteps?.includes(targetStatus) || false;
}

export function getNextSteps(currentStatus: GradeStatus): GradeStatus[] {
  return GRADE_WORKFLOW[currentStatus]?.nextSteps || [];
}

export function getWorkflowSteps(): Record<GradeStatus, GradeWorkflowStep> {
  return GRADE_WORKFLOW;
}
