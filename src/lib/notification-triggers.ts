// Notification triggers for system events

import { sendEmail, type EmailNotification } from "./email-service";
import { prisma } from "./prisma";
import { calculateAttendancePercentage } from "./attendance-utils";

function getMetadataValue(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export async function notifyAttendanceWarning(
  studentId: string,
  attendancePercentage: number,
  quarter: string
): Promise<void> {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { enrollments: { include: { section: true } } },
    });

    if (!student || !student.enrollments[0]) return;

    const enrollmentIds = student.enrollments.map((enrollment) => enrollment.id);
    const attendanceRecords = await prisma.attendanceRecord.findMany({
      where: {
        enrollmentId: { in: enrollmentIds },
        quarter: quarter as "FIRST" | "SECOND" | "THIRD" | "FOURTH",
      },
      select: { status: true },
    });

    const presentDays = attendanceRecords.filter((record) => record.status === "PRESENT").length;
    const absentDays = attendanceRecords.filter((record) => record.status === "ABSENT").length;
    const lateDays = attendanceRecords.filter((record) => record.status === "LATE").length;
    const excusedDays = attendanceRecords.filter((record) => record.status === "EXCUSED").length;

    // Get parent/guardian email (assuming stored in metadata)
    const parentEmail = getMetadataValue(student.metadata, "parentEmail");
    if (!parentEmail) return;

    await sendEmail({
      to: parentEmail,
      subject: `Attendance Warning - ${student.firstName} ${student.lastName}`,
      template: "attendance_warning",
      data: {
        parentName: getMetadataValue(student.metadata, "parentName") || "Parent",
        studentName: `${student.firstName} ${student.lastName}`,
        quarter,
        attendancePercentage,
        presentDays,
        absentDays,
        lateDays,
        excusedDays,
        schoolName: "School Name",
        schoolWebsite: "https://school.edu",
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending attendance warning:", err);
  }
}

export async function notifyGradePosted(
  enrollmentId: string,
  gradeId: string,
  subjectId: string,
  quarter: string
): Promise<void> {
  try {
    const [enrollment, grade, subject] = await Promise.all([
      prisma.enrollment.findUnique({
        where: { id: enrollmentId },
        include: { student: true },
      }),
      prisma.grade.findUnique({ where: { id: gradeId } }),
      prisma.subject.findUnique({ where: { id: subjectId } }),
    ]);

    if (!enrollment || !grade || !subject) return;

    const student = enrollment.student;
    const studentEmail = getMetadataValue(student.metadata, "email") || student.email;
    if (!studentEmail) return;

    // Determine grade description
    const gradeValue = grade[`${quarter}FinalGrade` as keyof typeof grade] as number | null;
    let description = "Grade posted";
    if (gradeValue) {
      if (gradeValue >= 90) description = "Excellent";
      else if (gradeValue >= 85) description = "Very Good";
      else if (gradeValue >= 80) description = "Good";
      else if (gradeValue >= 75) description = "Satisfactory";
      else if (gradeValue >= 70) description = "Needs Improvement";
      else description = "Failing";
    }

    await sendEmail({
      to: studentEmail,
      subject: `Grade Posted - ${subject.name}`,
      template: "grade_posted",
      data: {
        studentName: `${student.firstName} ${student.lastName}`,
        subject: subject.name,
        quarter,
        grade: gradeValue?.toFixed(2) || "N/A",
        gradeDescription: description,
        schoolPortal: "https://school.edu/portal",
        schoolName: "School Name",
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending grade posted notification:", err);
  }
}

export async function notifyEnrollmentConfirmation(enrollmentId: string): Promise<void> {
  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: true,
        section: true,
        academicYear: true,
      },
    });

    if (!enrollment) return;

    const parentEmail = getMetadataValue(enrollment.student.metadata, "parentEmail");
    if (!parentEmail) return;

    await sendEmail({
      to: parentEmail,
      subject: `Enrollment Confirmation`,
      template: "enrollment_confirmation",
      data: {
        parentName: getMetadataValue(enrollment.student.metadata, "parentName") || "Parent",
        studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        schoolName: "School Name",
        gradeLevel: enrollment.section?.gradeLevel || "",
        section: enrollment.section?.name || "",
        academicYear: enrollment.academicYear.year,
        lrn: enrollment.student.lrn,
        schoolStartDate: "2026-08-25",
        schoolWebsite: "https://school.edu",
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending enrollment confirmation:", err);
  }
}

export async function notifySystemAlert(
  alertType: string,
  message: string,
  targetRole: "SUPER_ADMIN" | "PRINCIPAL" | "ADMIN_OFFICER" = "SUPER_ADMIN"
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: targetRole, status: "ACTIVE" },
      select: { email: true },
    });

    for (const admin of admins) {
      if (!admin.email) continue;

      await sendEmail({
        to: admin.email,
        subject: `System Alert - ${alertType}`,
        template: "system_alert",
        data: {
          alertType,
          alertMessage: message,
          timestamp: new Date().toLocaleString(),
        },
        isHtml: true,
      });
    }
  } catch (err) {
    console.error("Error sending system alert:", err);
  }
}

export async function notifyUserInvitation(
  userId: string,
  email: string,
  role: string,
  schoolName: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) return;

    await sendEmail({
      to: email,
      subject: `Welcome to ${schoolName} - MISDMS`,
      template: "user_invitation",
      data: {
        userName: user.name,
        email,
        role,
        schoolName,
        loginUrl: "https://school.edu/login",
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending user invitation:", err);
  }
}

export async function notifyPasswordReset(
  email: string,
  userName: string,
  resetCode: string,
  resetUrl: string
): Promise<void> {
  try {
    await sendEmail({
      to: email,
      subject: "Reset Your MISDMS Password",
      template: "password_reset",
      data: {
        userName,
        resetCode,
        resetUrl,
        expirationMinutes: 30,
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending password reset:", err);
  }
}

export async function sendDailyDigest(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user || !user.email) return;

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [attendanceCount, gradesCount, enrollmentCount, attendanceRecords] = await Promise.all([
      prisma.attendanceRecord.count({ where: { createdAt: { gte: today } } }),
      prisma.grade.count({ where: { updatedAt: { gte: today } } }),
      prisma.enrollment.count({ where: { createdAt: { gte: today } } }),
      prisma.attendanceRecord.findMany({
        select: { enrollmentId: true, status: true },
      }),
    ]);

    const attendanceByEnrollment = new Map<string, string[]>();
    for (const record of attendanceRecords) {
      const statuses = attendanceByEnrollment.get(record.enrollmentId) || [];
      statuses.push(record.status);
      attendanceByEnrollment.set(record.enrollmentId, statuses);
    }

    const lowAttendanceCount = Array.from(attendanceByEnrollment.values()).filter((statuses) => {
      const present = statuses.filter((status) => status === "PRESENT").length;
      const absent = statuses.filter((status) => status === "ABSENT").length;
      const late = statuses.filter((status) => status === "LATE").length;
      const excused = statuses.filter((status) => status === "EXCUSED").length;
      return calculateAttendancePercentage(present, absent, late, excused) < 85;
    }).length;

    await sendEmail({
      to: user.email,
      subject: `Daily Digest - ${new Date().toLocaleDateString()}`,
      template: "daily_digest",
      data: {
        userName: user.name,
        schoolName: "School Name",
        attendanceCount,
        lowAttendanceCount,
        gradesPostedCount: gradesCount,
        pendingSubmissions: 0,
        newEnrollments: enrollmentCount,
        pendingEnrollments: 0,
        schoolPortal: "https://school.edu/portal",
      },
      isHtml: true,
    });
  } catch (err) {
    console.error("Error sending daily digest:", err);
  }
}
