import { prisma } from "./prisma";

export type AlertType =
  | "ATTENDANCE_WARNING"
  | "LOW_GRADE_ALERT"
  | "ENROLLMENT_INCOMPLETE"
  | "SYSTEM_ERROR"
  | "MAINTENANCE"
  | "GRADE_POSTED"
  | "DOCUMENT_SHARED"
  | "USER_ACTION_REQUIRED";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  targetRole?: string;
  targetUser?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  resolvedAt?: Date;
  isResolved: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  action: string;
  enabled: boolean;
  threshold?: number;
  recipients: string[];
  createdAt: Date;
}

const ALERT_CONFIG: Record<AlertType, { severity: AlertSeverity; template: string }> = {
  ATTENDANCE_WARNING: {
    severity: "WARNING",
    template: "Student {studentName} has attendance below {threshold}%",
  },
  LOW_GRADE_ALERT: {
    severity: "WARNING",
    template: "Student {studentName} has grades below passing ({gradeValue})",
  },
  ENROLLMENT_INCOMPLETE: {
    severity: "WARNING",
    template: "Section {sectionName} has incomplete enrollment",
  },
  SYSTEM_ERROR: {
    severity: "CRITICAL",
    template: "System error: {errorMessage}",
  },
  MAINTENANCE: {
    severity: "INFO",
    template: "Scheduled maintenance: {maintenanceDetails}",
  },
  GRADE_POSTED: {
    severity: "INFO",
    template: "Grades posted for {subjectName} - {quarter}",
  },
  DOCUMENT_SHARED: {
    severity: "INFO",
    template: "Document {documentName} has been shared with you",
  },
  USER_ACTION_REQUIRED: {
    severity: "WARNING",
    template: "Action required: {actionDescription}",
  },
};

export async function createAlert(
  type: AlertType,
  title: string,
  message: string,
  options?: {
    targetRole?: string;
    targetUser?: string;
    metadata?: Record<string, any>;
    severity?: AlertSeverity;
  }
): Promise<Alert> {
  const severity = options?.severity || ALERT_CONFIG[type].severity;

  const alert: Alert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity,
    title,
    message,
    targetRole: options?.targetRole,
    targetUser: options?.targetUser,
    metadata: options?.metadata,
    createdAt: new Date(),
    isResolved: false,
  };

  await prisma.auditLog
    .create({
      data: {
        action: "ALERT_CREATED",
        entityType: "ALERT",
        entityId: alert.id,
        details: {
          type,
          title,
          message,
          targetRole: alert.targetRole,
          targetUser: alert.targetUser,
          metadata: alert.metadata,
          severity,
        },
        performedById: alert.targetUser || null,
        ipAddress: "system",
      },
    })
    .catch(() => {});

  return alert;
}

export async function checkAttendanceThreshold(threshold: number = 85): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const enrollments = await prisma.enrollment.findMany({
    include: {
      student: true,
      attendanceRecords: true,
    },
  });

  for (const enrollment of enrollments) {
    const records = enrollment.attendanceRecords || [];
    if (records.length === 0) continue;

    const presentCount = records.filter((record) =>
      ["PRESENT", "LATE", "EXCUSED"].includes(record.status)
    ).length;
    const percentage = (presentCount / records.length) * 100;

    if (percentage < threshold) {
      alerts.push(
        await createAlert(
          "ATTENDANCE_WARNING",
          `Low Attendance: ${enrollment.student.firstName} ${enrollment.student.lastName}`,
          `Student has ${percentage.toFixed(2)}% attendance (below ${threshold}% threshold)`,
          {
            targetRole: "TEACHER",
            metadata: {
              studentId: enrollment.student.id,
              studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
              attendancePercentage: percentage,
              threshold,
            },
          }
        )
      );
    }
  }

  return alerts;
}

export async function checkLowGrades(threshold: number = 70): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const grades = await prisma.grade.findMany({
    include: {
      enrollment: {
        select: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      subject: { select: { name: true } },
    },
  });

  for (const grade of grades) {
    const gradeValues = [
      grade.q1Grade,
      grade.q2Grade,
      grade.q3Grade,
      grade.q4Grade,
      grade.finalGrade,
    ].filter((value): value is number => typeof value === "number");

    for (const gradeValue of gradeValues) {
      if (gradeValue < threshold) {
        alerts.push(
          await createAlert(
            "LOW_GRADE_ALERT",
            `Low Grade Alert: ${grade.enrollment.student.firstName} ${grade.enrollment.student.lastName}`,
            `Student received ${gradeValue} in ${grade.subject.name} (below ${threshold} threshold)`,
            {
              targetRole: "TEACHER",
              metadata: {
                studentId: grade.enrollment.student.id,
                studentName: `${grade.enrollment.student.firstName} ${grade.enrollment.student.lastName}`,
                subject: grade.subject.name,
                gradeValue,
                threshold,
              },
            }
          )
        );
        break;
      }
    }
  }

  return alerts;
}

export async function checkEnrollmentCompletion(
  minEnrollmentPercent: number = 80
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const sections = await prisma.section.findMany({
    include: {
      _count: { select: { enrollments: true } },
    },
  });

  for (const section of sections) {
    if (!section.capacity) continue;

    const enrollmentPercent = (section._count.enrollments / section.capacity) * 100;

    if (enrollmentPercent < minEnrollmentPercent) {
      alerts.push(
        await createAlert(
          "ENROLLMENT_INCOMPLETE",
          `Low Enrollment: ${section.name}`,
          `Section has ${enrollmentPercent.toFixed(1)}% enrollment (below ${minEnrollmentPercent}% target)`,
          {
            targetRole: "ADMIN_OFFICER",
            metadata: {
              sectionId: section.id,
              sectionName: section.name,
              enrollmentCount: section._count.enrollments,
              capacity: section.capacity,
              enrollmentPercent,
            },
          }
        )
      );
    }
  }

  return alerts;
}

export async function getAlertsByType(
  type: AlertType,
  limit: number = 50
): Promise<Alert[]> {
  const alerts = await evaluateAlertRules();
  return alerts.filter((alert) => alert.type === type).slice(0, limit);
}

export async function getAlertsBySeverity(
  severity: AlertSeverity,
  limit: number = 50
): Promise<Alert[]> {
  const alerts = await evaluateAlertRules();
  return alerts.filter((alert) => alert.severity === severity).slice(0, limit);
}

export async function getAlertsByUser(
  userId: string,
  limit: number = 50
): Promise<Alert[]> {
  const alerts = await evaluateAlertRules();
  return alerts.filter((alert) => alert.targetUser === userId).slice(0, limit);
}

export async function getAlertsByRole(
  role: string,
  limit: number = 50
): Promise<Alert[]> {
  const alerts = await evaluateAlertRules();
  return alerts.filter((alert) => alert.targetRole === role).slice(0, limit);
}

export async function getUnresolvedAlerts(limit: number = 100): Promise<Alert[]> {
  const alerts = await evaluateAlertRules();
  return alerts.filter((alert) => !alert.isResolved).slice(0, limit);
}

export async function resolveAlert(
  alertId: string,
  userId: string,
  notes?: string
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        action: "ALERT_RESOLVED",
        entityType: "ALERT",
        entityId: alertId,
        details: {
          notes: notes || "Alert resolved",
          resolvedBy: userId,
          resolvedAt: new Date().toISOString(),
        },
        performedById: userId,
        ipAddress: "system",
      },
    })
    .catch(() => {});
}

export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        action: "ALERT_DISMISSED",
        entityType: "ALERT",
        entityId: alertId,
        details: {
          dismissedBy: userId,
          dismissedAt: new Date().toISOString(),
        },
        performedById: userId,
        ipAddress: "system",
      },
    })
    .catch(() => {});
}

export async function createAlertRule(
  name: string,
  condition: string,
  action: string,
  recipients: string[]
): Promise<AlertRule> {
  const rule: AlertRule = {
    id: `rule_${Date.now()}`,
    name,
    condition,
    action,
    enabled: true,
    recipients,
    createdAt: new Date(),
  };

  return rule;
}

export async function getAlertRules(): Promise<AlertRule[]> {
  return [];
}

export async function updateAlertRule(
  ruleId: string,
  updates: Partial<AlertRule>
): Promise<AlertRule> {
  return {
    id: ruleId,
    name: updates.name || "Alert Rule",
    condition: updates.condition || "",
    action: updates.action || "NOTIFY",
    enabled: updates.enabled ?? true,
    recipients: updates.recipients || [],
    createdAt: new Date(),
  };
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  return;
}

export async function evaluateAlertRules(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const attendanceAlerts = await checkAttendanceThreshold(85);
  alerts.push(...attendanceAlerts);

  const gradeAlerts = await checkLowGrades(70);
  alerts.push(...gradeAlerts);

  const enrollmentAlerts = await checkEnrollmentCompletion(80);
  alerts.push(...enrollmentAlerts);

  return alerts;
}

export async function sendAlertNotifications(
  alerts: Alert[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const alert of alerts) {
    try {
      sent++;
    } catch (err) {
      failed++;
      console.error("Failed to send alert:", err);
    }
  }

  return { sent, failed };
}

export async function getAlertSummary(): Promise<{
  total: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<AlertType, number>;
  unresolved: number;
}> {
  const alerts = await getUnresolvedAlerts(200);
  const bySeverity: Record<AlertSeverity, number> = { INFO: 0, WARNING: 0, CRITICAL: 0 };
  const byType: Record<AlertType, number> = {
    ATTENDANCE_WARNING: 0,
    LOW_GRADE_ALERT: 0,
    ENROLLMENT_INCOMPLETE: 0,
    SYSTEM_ERROR: 0,
    MAINTENANCE: 0,
    GRADE_POSTED: 0,
    DOCUMENT_SHARED: 0,
    USER_ACTION_REQUIRED: 0,
  };

  for (const alert of alerts) {
    bySeverity[alert.severity] += 1;
    byType[alert.type] += 1;
  }

  return {
    total: alerts.length,
    bySeverity,
    byType,
    unresolved: alerts.length,
  };
}

export function getAlertTemplate(type: AlertType): string {
  return ALERT_CONFIG[type].template;
}

export function interpolateTemplate(
  template: string,
  variables: Record<string, any>
): string {
  return template.replace(/{(\w+)}/g, (match, key) => {
    return String(variables[key] || match);
  });
}
