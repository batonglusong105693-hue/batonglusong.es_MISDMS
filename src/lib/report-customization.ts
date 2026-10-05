import { prisma } from "./prisma";

const customTemplateStore = new Map<string, ReportTemplate>();

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: "class_record" | "master_list" | "attendance" | "grades" | "enrollment";
  fields: string[];
  filters: Record<string, any>;
  sorting: { field: string; order: "asc" | "desc" }[];
  createdBy: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportConfig {
  templateId?: string;
  type: string;
  fields: string[];
  filters?: Record<string, any>;
  sorting?: { field: string; order: "asc" | "desc" }[];
  format: "pdf" | "csv" | "json";
  includeStats: boolean;
}

const DEFAULT_TEMPLATES: Record<string, Partial<ReportTemplate>> = {
  class_record_default: {
    name: "Class Record - Full",
    type: "class_record",
    fields: [
      "studentName",
      "lrn",
      "q1Score",
      "q2Score",
      "q3Score",
      "q4Score",
      "finalGrade",
      "gradeDescription",
    ],
    isDefault: true,
  },
  master_list_default: {
    name: "Master List - Full",
    type: "master_list",
    fields: [
      "studentName",
      "lrn",
      "gender",
      "attendance",
      "q1FinalGrade",
      "q2FinalGrade",
      "q3FinalGrade",
      "q4FinalGrade",
      "generalAverage",
      "remarks",
    ],
    isDefault: true,
  },
  attendance_default: {
    name: "Attendance Report - Summary",
    type: "attendance",
    fields: [
      "studentName",
      "lrn",
      "presentDays",
      "absentDays",
      "lateDays",
      "excusedDays",
      "attendancePercentage",
      "status",
    ],
    isDefault: true,
  },
};

export async function createReportTemplate(
  template: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt">
): Promise<ReportTemplate> {
  const id = `template_${Date.now()}`;

  const stored: ReportTemplate = {
    id,
    ...template,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  customTemplateStore.set(id, stored);

  // In production, save to database
  // await prisma.reportTemplate.create({ data: stored });

  return stored;
}

export async function getReportTemplate(templateId: string): Promise<ReportTemplate | null> {
  const custom = customTemplateStore.get(templateId);
  if (custom) return custom;

  // In production: await prisma.reportTemplate.findUnique({ where: { id: templateId } });
  return null;
}

export async function listReportTemplates(
  userId: string,
  type?: string
): Promise<ReportTemplate[]> {
  // In production:
  // const where = type ? { type, OR: [{ createdBy: userId }, { isDefault: true }] } : { OR: [{ createdBy: userId }, { isDefault: true }] };
  // return await prisma.reportTemplate.findMany({ where, orderBy: { createdAt: "desc" } });

  const defaults = Object.values(DEFAULT_TEMPLATES).map((t) => ({
    id: `default_${t.type}`,
    name: t.name!,
    description: "",
    type: t.type as any,
    fields: t.fields || [],
    filters: {},
    sorting: [],
    createdBy: "system",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  const custom = Array.from(customTemplateStore.values()).filter(
    (template) => template.createdBy === userId && (!type || template.type === type)
  );

  return type
    ? [...custom, ...defaults.filter((t) => t.type === type)]
    : [...custom, ...defaults];
}

export async function deleteReportTemplate(templateId: string): Promise<void> {
  if (templateId.startsWith("default_")) {
    throw new Error("Cannot delete default templates");
  }

  if (customTemplateStore.has(templateId)) {
    customTemplateStore.delete(templateId);
    return;
  }
  // In production: await prisma.reportTemplate.delete({ where: { id: templateId } });
}

export async function updateReportTemplate(
  templateId: string,
  updates: Partial<ReportTemplate>
): Promise<ReportTemplate> {
  if (templateId.startsWith("default_")) {
    throw new Error("Cannot modify default templates");
  }

  const existing = customTemplateStore.get(templateId);
  if (!existing) {
    throw new Error("Template not found");
  }

  const updated: ReportTemplate = {
    ...existing,
    ...updates,
    updatedAt: new Date(),
  };

  customTemplateStore.set(templateId, updated);

  // In production: return await prisma.reportTemplate.update({ where: { id: templateId }, data: updates });
  return updated;
}

export async function generateClassRecordReport(
  config: ReportConfig,
  sectionId: string,
  subjectId: string,
  quarter: string
): Promise<any[]> {
  const grades = await prisma.grade.findMany({
    where: {
      enrollment: {
        section: { id: sectionId },
      },
      subjectId,
    },
    include: {
      enrollment: {
        select: {
          student: {
            select: {
              id: true,
              lrn: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      subject: { select: { name: true } },
    },
  });

  const fieldMap: Record<string, (grade: any) => any> = {
    studentName: (g) => `${g.enrollment.student.firstName} ${g.enrollment.student.lastName}`,
    lrn: (g) => g.enrollment.student.lrn,
    q1Score: (g) => g.firstQuarterScore || "—",
    q2Score: (g) => g.secondQuarterScore || "—",
    q3Score: (g) => g.thirdQuarterScore || "—",
    q4Score: (g) => g.fourthQuarterScore || "—",
    finalGrade: (g) => getQuarterFinalGrade(g, quarter),
    gradeDescription: (g) => getGradeDescription(getQuarterFinalGrade(g, quarter)),
  };

  return grades.map((grade) => {
    const row: Record<string, any> = {};
    for (const field of config.fields) {
      if (fieldMap[field]) {
        row[field] = fieldMap[field](grade);
      }
    }
    return row;
  });
}

export async function generateMasterListReport(
  config: ReportConfig,
  sectionId: string,
  quarter: string
): Promise<any[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { section: { id: sectionId } },
    include: {
      student: {
        select: {
          id: true,
          lrn: true,
          firstName: true,
          lastName: true,
          gender: true,
        },
      },
      grades: {
        select: {
          firstFinalGrade: true,
          secondFinalGrade: true,
          thirdFinalGrade: true,
          fourthFinalGrade: true,
        },
      },
    },
  });

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      enrollment: { section: { id: sectionId } },
    },
  });

  const fieldMap: Record<string, (data: any) => any> = {
    studentName: (e) => `${e.student.firstName} ${e.student.lastName}`,
    lrn: (e) => e.student.lrn,
    gender: (e) => e.student.gender,
    attendance: (e) => {
      const records = attendanceRecords.filter((r) => r.enrollmentId === e.id);
      const present = records.filter((r) => r.status === "PRESENT").length;
      const total = records.length;
      return total > 0 ? `${present}/${total}` : "—";
    },
    q1FinalGrade: (e) =>
      e.grades[0]?.firstFinalGrade?.toFixed(2) || "—",
    q2FinalGrade: (e) =>
      e.grades[0]?.secondFinalGrade?.toFixed(2) || "—",
    q3FinalGrade: (e) =>
      e.grades[0]?.thirdFinalGrade?.toFixed(2) || "—",
    q4FinalGrade: (e) =>
      e.grades[0]?.fourthFinalGrade?.toFixed(2) || "—",
    generalAverage: (e) => {
      const grades = e.grades[0];
      if (!grades) return "—";
      const avg =
        (grades.firstFinalGrade +
          grades.secondFinalGrade +
          grades.thirdFinalGrade +
          grades.fourthFinalGrade) /
        4;
      return avg?.toFixed(2) || "—";
    },
    remarks: (e) => {
      const grades = e.grades[0];
      if (!grades) return "—";
      const avg =
        (grades.firstFinalGrade +
          grades.secondFinalGrade +
          grades.thirdFinalGrade +
          grades.fourthFinalGrade) /
        4;
      return avg >= 75 ? "PASSED" : "FAILED";
    },
  };

  return enrollments.map((enrollment) => {
    const row: Record<string, any> = {};
    for (const field of config.fields) {
      if (fieldMap[field]) {
        row[field] = fieldMap[field](enrollment);
      }
    }
    return row;
  });
}

export async function generateAttendanceReport(
  config: ReportConfig,
  sectionId: string,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { section: { id: sectionId } },
    include: { student: { select: { id: true, lrn: true, firstName: true, lastName: true } } },
  });

  const attendanceMap: Record<string, any[]> = {};

  for (const enrollment of enrollments) {
    const where: any = { enrollmentId: enrollment.id };
    if (startDate && endDate) {
      where.date = { gte: startDate, lte: endDate };
    }

    const records = await prisma.attendanceRecord.findMany({ where });
    attendanceMap[enrollment.id] = records;
  }

  const fieldMap: Record<string, (data: any) => any> = {
    studentName: (e) => `${e.student.firstName} ${e.student.lastName}`,
    lrn: (e) => e.student.lrn,
    presentDays: (e) =>
      attendanceMap[e.id]?.filter((r) => r.status === "PRESENT").length || 0,
    absentDays: (e) =>
      attendanceMap[e.id]?.filter((r) => r.status === "ABSENT").length || 0,
    lateDays: (e) =>
      attendanceMap[e.id]?.filter((r) => r.status === "LATE").length || 0,
    excusedDays: (e) =>
      attendanceMap[e.id]?.filter((r) => r.status === "EXCUSED").length || 0,
    attendancePercentage: (e) => {
      const records = attendanceMap[e.id] || [];
      if (records.length === 0) return "—";
      const counted = records.filter((r) =>
        ["PRESENT", "LATE", "EXCUSED"].includes(r.status)
      ).length;
      return ((counted / records.length) * 100).toFixed(2) + "%";
    },
    status: (e) => {
      const percentage = parseFloat(
        attendanceMap[e.id]
          ? (
              (attendanceMap[e.id].filter((r) =>
                ["PRESENT", "LATE", "EXCUSED"].includes(r.status)
              ).length /
                attendanceMap[e.id].length) *
              100
            ).toFixed(2)
          : "0"
      );
      if (percentage >= 90) return "GOOD";
      if (percentage >= 85) return "WARNING";
      return "POOR";
    },
  };

  return enrollments.map((enrollment) => {
    const row: Record<string, any> = {};
    for (const field of config.fields) {
      if (fieldMap[field]) {
        row[field] = fieldMap[field](enrollment);
      }
    }
    return row;
  });
}

function getQuarterFinalGrade(grade: any, quarter: string): number | string {
  const fieldMap: Record<string, string> = {
    FIRST: "firstFinalGrade",
    SECOND: "secondFinalGrade",
    THIRD: "thirdFinalGrade",
    FOURTH: "fourthFinalGrade",
  };
  return grade[fieldMap[quarter]] || "—";
}

function getGradeDescription(grade: any): string {
  const gradeValue = typeof grade === "number" ? grade : 0;
  if (gradeValue >= 90) return "Excellent";
  if (gradeValue >= 85) return "Very Good";
  if (gradeValue >= 80) return "Good";
  if (gradeValue >= 75) return "Satisfactory";
  if (gradeValue >= 70) return "Needs Improvement";
  return "Failing";
}

export function convertToCSV(data: any[], fields: string[]): string {
  if (data.length === 0) return "";

  const headers = fields.join(",");
  const rows = data.map((row) =>
    fields
      .map((field) => {
        const value = row[field] || "";
        return typeof value === "string" && value.includes(",")
          ? `"${value}"`
          : value;
      })
      .join(",")
  );

  return [headers, ...rows].join("\n");
}

export function convertToJSON(data: any[]): string {
  return JSON.stringify(data, null, 2);
}
