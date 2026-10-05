import { prisma } from "./prisma";

export interface AnalyticsMetric {
  label: string;
  value: number;
  unit: string;
  trend?: "up" | "down" | "stable";
  trendPercent?: number;
}

export interface DashboardStats {
  students: AnalyticsMetric;
  faculty: AnalyticsMetric;
  sections: AnalyticsMetric;
  averageAttendance: AnalyticsMetric;
  averageGPA: AnalyticsMetric;
  enrollment: AnalyticsMetric;
}

export interface AttendanceTrend {
  date: string;
  percentage: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
}

export interface GradeTrend {
  quarter: string;
  averageGrade: number;
  passRate: number;
  studentCount: number;
}

export interface StudentPerformance {
  studentName: string;
  lrn: string;
  section: string;
  q1Grade: number | null;
  q2Grade: number | null;
  q3Grade: number | null;
  q4Grade: number | null;
  generalAverage: number;
  attendanceRate: number;
  status: "EXCELLENT" | "GOOD" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "FAILING";
}

export interface EnrollmentTrend {
  academicYear: string;
  gradeLevel: string;
  totalEnrolled: number;
  totalActive: number;
  totalInactive: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [studentCount, facultyCount, sectionCount, enrollmentCount] = await Promise.all([
    prisma.student.count({ where: { status: "ENROLLED" } }),
    prisma.user.count({ where: { status: "ACTIVE", role: { in: ["TEACHER", "ADVISER"] } } }),
    prisma.section.count(),
    prisma.enrollment.count({ where: { status: "ENROLLED" } }),
  ]);

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    select: { status: true },
  });

  const attendancePercentage = attendanceRecords.length > 0
    ? (attendanceRecords.filter((r) => ["PRESENT", "LATE", "EXCUSED"].includes(r.status)).length /
        attendanceRecords.length) *
      100
    : 0;

  const grades = await prisma.grade.findMany({
    select: {
      firstFinalGrade: true,
      secondFinalGrade: true,
      thirdFinalGrade: true,
      fourthFinalGrade: true,
    },
  });

  const allGrades = grades.flatMap((g) => [
    g.firstFinalGrade,
    g.secondFinalGrade,
    g.thirdFinalGrade,
    g.fourthFinalGrade,
  ]).filter((g) => g !== null);

  const averageGPA = allGrades.length > 0
    ? allGrades.reduce((a, b) => a + (b as number), 0) / allGrades.length
    : 0;

  return {
    students: {
      label: "Active Students",
      value: studentCount,
      unit: "students",
    },
    faculty: {
      label: "Faculty Members",
      value: facultyCount,
      unit: "staff",
    },
    sections: {
      label: "Class Sections",
      value: sectionCount,
      unit: "sections",
    },
    averageAttendance: {
      label: "Average Attendance",
      value: Math.round(attendancePercentage * 100) / 100,
      unit: "%",
    },
    averageGPA: {
      label: "Average GPA",
      value: Math.round(averageGPA * 100) / 100,
      unit: "GPA",
    },
    enrollment: {
      label: "Total Enrollment",
      value: enrollmentCount,
      unit: "students",
    },
  };
}

export async function getAttendanceTrend(days: number = 30): Promise<AttendanceTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: startDate },
    },
    orderBy: { date: "asc" },
  });

  const grouped: Record<string, AttendanceTrend> = {};

  for (const record of records) {
    const dateStr = new Date(record.date).toISOString().split("T")[0];

    if (!grouped[dateStr]) {
      grouped[dateStr] = {
        date: dateStr,
        percentage: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
    }

    if (record.status === "PRESENT") grouped[dateStr].present++;
    if (record.status === "ABSENT") grouped[dateStr].absent++;
    if (record.status === "LATE") grouped[dateStr].late++;
    if (record.status === "EXCUSED") grouped[dateStr].excused++;
  }

  for (const trend of Object.values(grouped)) {
    const total = trend.present + trend.absent + trend.late + trend.excused;
    trend.percentage = total > 0
      ? Math.round(((trend.present + trend.late + trend.excused) / total) * 100 * 100) / 100
      : 0;
  }

  return Object.values(grouped);
}

export async function getGradeTrend(): Promise<GradeTrend[]> {
  const grades = await prisma.grade.findMany({
    select: {
      firstFinalGrade: true,
      secondFinalGrade: true,
      thirdFinalGrade: true,
      fourthFinalGrade: true,
    },
  });

  const quarters = ["FIRST", "SECOND", "THIRD", "FOURTH"];
  const trends: GradeTrend[] = [];

  for (let i = 0; i < 4; i++) {
    const gradeField = ["firstFinalGrade", "secondFinalGrade", "thirdFinalGrade", "fourthFinalGrade"][i] as keyof typeof grades[0];
    const quarterGrades = grades
      .map((g) => g[gradeField])
      .filter((g) => g !== null) as number[];

    const average = quarterGrades.length > 0
      ? quarterGrades.reduce((a, b) => a + b, 0) / quarterGrades.length
      : 0;

    const passCount = quarterGrades.filter((g) => g >= 75).length;
    const passRate = quarterGrades.length > 0
      ? Math.round((passCount / quarterGrades.length) * 100 * 100) / 100
      : 0;

    trends.push({
      quarter: quarters[i],
      averageGrade: Math.round(average * 100) / 100,
      passRate,
      studentCount: quarterGrades.length,
    });
  }

  return trends;
}

export async function getStudentPerformance(sectionId: string): Promise<StudentPerformance[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { section: { id: sectionId } },
    include: {
      student: true,
      section: true,
      grades: true,
    },
  });

  const attendanceMap = new Map<string, { present: number; total: number }>();
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      enrollment: { section: { id: sectionId } },
    },
  });

  for (const record of attendanceRecords) {
    const key = record.enrollmentId;
    if (!attendanceMap.has(key)) {
      attendanceMap.set(key, { present: 0, total: 0 });
    }
    const stats = attendanceMap.get(key)!;
    stats.total++;
    if (["PRESENT", "LATE", "EXCUSED"].includes(record.status)) {
      stats.present++;
    }
  }

  return enrollments.map((e) => {
    const grades = e.grades[0];
    const q1 = grades?.firstFinalGrade || null;
    const q2 = grades?.secondFinalGrade || null;
    const q3 = grades?.thirdFinalGrade || null;
    const q4 = grades?.fourthFinalGrade || null;

    const allGrades = [q1, q2, q3, q4].filter((g) => g !== null) as number[];
    const generalAverage = allGrades.length > 0
      ? Math.round((allGrades.reduce((a, b) => a + b, 0) / allGrades.length) * 100) / 100
      : 0;

    const attendance = attendanceMap.get(e.id);
    const attendanceRate = attendance && attendance.total > 0
      ? Math.round((attendance.present / attendance.total) * 100 * 100) / 100
      : 0;

    let status: StudentPerformance["status"] = "SATISFACTORY";
    if (generalAverage >= 90) status = "EXCELLENT";
    else if (generalAverage >= 85) status = "GOOD";
    else if (generalAverage >= 75) status = "SATISFACTORY";
    else if (generalAverage >= 70) status = "NEEDS_IMPROVEMENT";
    else status = "FAILING";

    return {
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      lrn: e.student.lrn,
      section: e.section?.name || "Unassigned",
      q1Grade: q1,
      q2Grade: q2,
      q3Grade: q3,
      q4Grade: q4,
      generalAverage,
      attendanceRate,
      status,
    };
  });
}

export async function getEnrollmentTrend(): Promise<EnrollmentTrend[]> {
  const enrollments = await prisma.enrollment.findMany({
    include: {
      section: true,
      academicYear: true,
    },
  });

  const grouped: Record<string, EnrollmentTrend> = {};

  for (const enrollment of enrollments) {
    if (!enrollment.section) continue;
    const key = `${enrollment.academicYear.year}-${enrollment.section.gradeLevel}`;

    if (!grouped[key]) {
      grouped[key] = {
        academicYear: enrollment.academicYear.year,
        gradeLevel: enrollment.section.gradeLevel,
        totalEnrolled: 0,
        totalActive: 0,
        totalInactive: 0,
      };
    }

    grouped[key].totalEnrolled++;
    if (enrollment.status === "ENROLLED") {
      grouped[key].totalActive++;
    } else {
      grouped[key].totalInactive++;
    }
  }

  return Object.values(grouped).sort((a, b) => {
    if (a.academicYear !== b.academicYear) {
      return b.academicYear.localeCompare(a.academicYear);
    }
    return a.gradeLevel.localeCompare(b.gradeLevel);
  });
}

export async function getTopPerformers(sectionId: string, limit: number = 10): Promise<StudentPerformance[]> {
  const performance = await getStudentPerformance(sectionId);
  return performance
    .sort((a, b) => b.generalAverage - a.generalAverage)
    .slice(0, limit);
}

export async function getAtRiskStudents(sectionId: string): Promise<StudentPerformance[]> {
  const performance = await getStudentPerformance(sectionId);
  return performance.filter(
    (p) =>
      p.status === "FAILING" ||
      p.status === "NEEDS_IMPROVEMENT" ||
      p.attendanceRate < 85
  );
}

export async function getGradeDistribution(sectionId: string): Promise<Record<string, number>> {
  const grades = await prisma.grade.findMany({
    where: {
      enrollment: { section: { id: sectionId } },
    },
    select: {
      firstFinalGrade: true,
      secondFinalGrade: true,
      thirdFinalGrade: true,
      fourthFinalGrade: true,
    },
  });

  const distribution: Record<string, number> = {
    "90-100": 0,
    "80-89": 0,
    "70-79": 0,
    "60-69": 0,
    "Below 60": 0,
  };

  const allGrades = grades
    .flatMap((g) => [
      g.firstFinalGrade,
      g.secondFinalGrade,
      g.thirdFinalGrade,
      g.fourthFinalGrade,
    ])
    .filter((g) => g !== null) as number[];

  for (const grade of allGrades) {
    if (grade >= 90) distribution["90-100"]++;
    else if (grade >= 80) distribution["80-89"]++;
    else if (grade >= 70) distribution["70-79"]++;
    else if (grade >= 60) distribution["60-69"]++;
    else distribution["Below 60"]++;
  }

  return distribution;
}

export async function getAttendanceByStudent(sectionId: string): Promise<Record<string, number>> {
  const enrollments = await prisma.enrollment.findMany({
    where: { section: { id: sectionId } },
    include: { student: true },
  });

  const studentAttendance: Record<string, number> = {};

  for (const enrollment of enrollments) {
    const records = await prisma.attendanceRecord.findMany({
      where: { enrollmentId: enrollment.id },
    });

    const present = records.filter((r) => ["PRESENT", "LATE", "EXCUSED"].includes(r.status)).length;
    const percentage = records.length > 0
      ? Math.round((present / records.length) * 100 * 100) / 100
      : 0;

    studentAttendance[`${enrollment.student.firstName} ${enrollment.student.lastName}`] = percentage;
  }

  return studentAttendance;
}

export function calculateGradeStats(grades: number[]): {
  mean: number;
  median: number;
  mode: number | null;
  standardDeviation: number;
  min: number;
  max: number;
} {
  if (grades.length === 0) {
    return { mean: 0, median: 0, mode: null, standardDeviation: 0, min: 0, max: 0 };
  }

  const sorted = [...grades].sort((a, b) => a - b);
  const mean = grades.reduce((a, b) => a + b, 0) / grades.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const frequency: Record<number, number> = {};
  grades.forEach((g) => {
    frequency[g] = (frequency[g] || 0) + 1;
  });
  const mode = Object.keys(frequency).length > 0
    ? parseInt(Object.entries(frequency).sort(([, a], [, b]) => b - a)[0][0])
    : null;

  const variance =
    grades.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / grades.length;
  const standardDeviation = Math.sqrt(variance);

  return {
    mean: Math.round(mean * 100) / 100,
    median,
    mode,
    standardDeviation: Math.round(standardDeviation * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}
