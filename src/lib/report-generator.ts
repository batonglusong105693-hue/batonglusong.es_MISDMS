// Report generation utilities for DepEd compliance

import { prisma } from "@/lib/prisma";

export interface StudentGradeData {
  enrollmentId: string;
  studentId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  q1Grade: number | null;
  q2Grade: number | null;
  q3Grade: number | null;
  q4Grade: number | null;
  finalGrade: number | null;
  yearLevel: string;
}

export interface StudentAttendanceData {
  enrollmentId: string;
  studentId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
  attendanceStatus: "GOOD" | "WARNING" | "POOR";
}

export interface ClassRecordData {
  sectionName: string;
  gradeLevel: string;
  adviserId: string;
  adviserName: string;
  academicYear: string;
  subjectName: string;
  quarter: "FIRST" | "SECOND" | "THIRD" | "FOURTH";
  students: StudentGradeData[];
  generatedAt: Date;
}

export interface MasterListData {
  sectionName: string;
  gradeLevel: string;
  adviserId: string;
  adviserName: string;
  academicYear: string;
  students: StudentAttendanceData[];
  generatedAt: Date;
}

export async function getClassRecordData(
  sectionId: string,
  subjectId: string,
  quarter: "FIRST" | "SECOND" | "THIRD" | "FOURTH"
): Promise<ClassRecordData | null> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      adviser: true,
      academicYear: true,
    },
  });

  if (!section || !section.adviser || !section.academicYear) {
    return null;
  }

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
  });

  if (!subject) {
    return null;
  }

  // Get all enrolled students and their grades
  const enrollments = await prisma.enrollment.findMany({
    where: {
      sectionId,
      status: "ENROLLED",
      academicYearId: section.academicYearId,
    },
    include: {
      student: true,
      grades: {
        where: { subjectId },
        select: {
          q1PeriodicTest: true,
          q2PeriodicTest: true,
          q3PeriodicTest: true,
          q4PeriodicTest: true,
          q1FinalGrade: true,
          q2FinalGrade: true,
          q3FinalGrade: true,
          q4FinalGrade: true,
          finalGrade: true,
        },
      },
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  const quarterMap = {
    FIRST: { gradeField: "q1FinalGrade" as const },
    SECOND: { gradeField: "q2FinalGrade" as const },
    THIRD: { gradeField: "q3FinalGrade" as const },
    FOURTH: { gradeField: "q4FinalGrade" as const },
  };

  const students: StudentGradeData[] = enrollments.map((e) => {
    const grade = e.grades[0];
    const quarterInfo = quarterMap[quarter];

    return {
      enrollmentId: e.id,
      studentId: e.student.id,
      lrn: e.student.lrn,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      q1Grade: grade?.q1FinalGrade || null,
      q2Grade: grade?.q2FinalGrade || null,
      q3Grade: grade?.q3FinalGrade || null,
      q4Grade: grade?.q4FinalGrade || null,
      finalGrade: grade?.finalGrade || null,
      yearLevel: section.gradeLevel,
    };
  });

  return {
    sectionName: section.name,
    gradeLevel: section.gradeLevel,
    adviserId: section.adviserId || "",
    adviserName: section.adviser.name,
    academicYear: section.academicYear.year,
    subjectName: subject.name,
    quarter,
    students,
    generatedAt: new Date(),
  };
}

export async function getMasterListData(
  sectionId: string,
  quarter: "FIRST" | "SECOND" | "THIRD" | "FOURTH"
): Promise<MasterListData | null> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      adviser: true,
      academicYear: true,
    },
  });

  if (!section || !section.adviser || !section.academicYear) {
    return null;
  }

  // Get all enrolled students
  const enrollments = await prisma.enrollment.findMany({
    where: {
      sectionId,
      status: "ENROLLED",
      academicYearId: section.academicYearId,
    },
    include: {
      student: true,
    },
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
  });

  // Get attendance summary for each student
  const students: StudentAttendanceData[] = await Promise.all(
    enrollments.map(async (e) => {
      const attendance = await prisma.attendanceRecord.findMany({
        where: {
          enrollmentId: e.id,
          quarter,
        },
      });

      const present = attendance.filter((a) => a.status === "PRESENT").length;
      const absent = attendance.filter((a) => a.status === "ABSENT").length;
      const late = attendance.filter((a) => a.status === "LATE").length;
      const excused = attendance.filter((a) => a.status === "EXCUSED").length;
      const total = attendance.length;

      const percentage = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;
      const status: "GOOD" | "WARNING" | "POOR" =
        percentage >= 90 ? "GOOD" : percentage >= 85 ? "WARNING" : "POOR";

      return {
        enrollmentId: e.id,
        studentId: e.student.id,
        lrn: e.student.lrn,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        presentDays: present,
        absentDays: absent,
        lateDays: late,
        excusedDays: excused,
        attendancePercentage: percentage,
        attendanceStatus: status,
      };
    })
  );

  return {
    sectionName: section.name,
    gradeLevel: section.gradeLevel,
    adviserId: section.adviserId || "",
    adviserName: section.adviser.name,
    academicYear: section.academicYear.year,
    students,
    generatedAt: new Date(),
  };
}

export function calculateFinalGrade(q1: number | null, q2: number | null, q3: number | null, q4: number | null): number | null {
  const grades = [q1, q2, q3, q4].filter((g) => g !== null) as number[];
  if (grades.length === 0) return null;
  return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length);
}

export function getGradeDescription(grade: number | null): string {
  if (grade === null) return "No Grade";
  if (grade >= 90) return "Excellent";
  if (grade >= 85) return "Very Good";
  if (grade >= 80) return "Good";
  if (grade >= 75) return "Satisfactory";
  if (grade >= 70) return "Needs Improvement";
  return "Failed";
}

export function formatQuarterLabel(quarter: string): string {
  const map: Record<string, string> = {
    FIRST: "First Quarter (June-August)",
    SECOND: "Second Quarter (September-November)",
    THIRD: "Third Quarter (December-February)",
    FOURTH: "Fourth Quarter (March-May)",
  };
  return map[quarter] || quarter;
}

export function generateCSVFromClassRecord(data: ClassRecordData): string {
  const headers = [
    "LRN",
    "Last Name",
    "First Name",
    "Q1 Grade",
    "Q2 Grade",
    "Q3 Grade",
    "Q4 Grade",
    "Final Grade",
  ];

  const rows = data.students.map((s) => [
    s.lrn,
    s.lastName,
    s.firstName,
    s.q1Grade?.toString() || "",
    s.q2Grade?.toString() || "",
    s.q3Grade?.toString() || "",
    s.q4Grade?.toString() || "",
    s.finalGrade?.toString() || "",
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return csv;
}

export function generateCSVFromMasterList(data: MasterListData): string {
  const headers = [
    "LRN",
    "Last Name",
    "First Name",
    "Present",
    "Absent",
    "Late",
    "Excused",
    "Attendance %",
    "Status",
  ];

  const rows = data.students.map((s) => [
    s.lrn,
    s.lastName,
    s.firstName,
    s.presentDays.toString(),
    s.absentDays.toString(),
    s.lateDays.toString(),
    s.excusedDays.toString(),
    s.attendancePercentage.toString(),
    s.attendanceStatus,
  ]);

  const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
  return csv;
}
