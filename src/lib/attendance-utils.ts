export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  enrollmentId: string;
  date: Date;
  status: AttendanceStatus;
  quarter: "FIRST" | "SECOND" | "THIRD" | "FOURTH";
  remarks?: string;
  recordedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceSummary {
  studentId: string;
  studentName: string;
  quarter: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
  status: "GOOD" | "WARNING" | "POOR";
}

export interface QuarterStats {
  quarter: string;
  startDate: Date;
  endDate: Date;
}

// Get current quarter based on date
export function getCurrentQuarter(date: Date): "FIRST" | "SECOND" | "THIRD" | "FOURTH" {
  const month = date.getMonth() + 1; // 1-12

  if (month >= 6 && month <= 8) return "FIRST";
  if (month >= 9 && month <= 11) return "SECOND";
  if (month >= 12 || month <= 2) return "THIRD";
  return "FOURTH";
}

// Calculate attendance percentage
export function calculateAttendancePercentage(
  presentDays: number,
  absentDays: number,
  lateDays: number,
  excusedDays: number
): number {
  const totalDays = presentDays + absentDays + lateDays + excusedDays;
  if (totalDays === 0) return 100;

  // Count present + late + excused as "attended"
  const attendedDays = presentDays + lateDays + excusedDays;
  return Math.round((attendedDays / totalDays) * 100);
}

// Determine attendance status based on percentage
export function getAttendanceStatus(percentage: number): "GOOD" | "WARNING" | "POOR" {
  if (percentage >= 90) return "GOOD";
  if (percentage >= 85) return "WARNING";
  return "POOR";
}

// Format date for API calls (YYYY-MM-DD)
export function formatDateForAPI(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Parse date from API (YYYY-MM-DD to Date)
export function parseDateFromAPI(dateString: string): Date {
  return new Date(dateString + "T00:00:00Z");
}

// Get date range for quarter
export function getQuarterDateRange(year: number, quarter: "FIRST" | "SECOND" | "THIRD" | "FOURTH") {
  switch (quarter) {
    case "FIRST":
      return { start: new Date(year, 5, 1), end: new Date(year, 7, 31) }; // June-August
    case "SECOND":
      return { start: new Date(year, 8, 1), end: new Date(year, 10, 30) }; // Sept-Nov
    case "THIRD":
      return { start: new Date(year, 11, 1), end: new Date(year + 1, 1, 28) }; // Dec-Feb
    case "FOURTH":
      return { start: new Date(year + 1, 2, 1), end: new Date(year + 1, 4, 31) }; // March-May
  }
}

// Validate date is within working days (Monday-Friday, no holidays)
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday or Saturday
}

// Generate consecutive working days for a date range
export function getWorkingDaysInRange(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isWorkingDay(current)) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

// Batch process attendance records
export function groupAttendanceByStudent(
  records: AttendanceRecord[]
): Map<string, AttendanceRecord[]> {
  const grouped = new Map<string, AttendanceRecord[]>();

  for (const record of records) {
    if (!grouped.has(record.studentId)) {
      grouped.set(record.studentId, []);
    }
    grouped.get(record.studentId)!.push(record);
  }

  return grouped;
}

// Generate attendance report data
export function generateAttendanceReport(
  records: AttendanceRecord[],
  students: Array<{ id: string; firstName: string; lastName: string }>
): AttendanceSummary[] {
  const grouped = groupAttendanceByStudent(records);
  const summaries: AttendanceSummary[] = [];

  for (const student of students) {
    const studentRecords = grouped.get(student.id) || [];

    const present = studentRecords.filter((r) => r.status === "PRESENT").length;
    const absent = studentRecords.filter((r) => r.status === "ABSENT").length;
    const late = studentRecords.filter((r) => r.status === "LATE").length;
    const excused = studentRecords.filter((r) => r.status === "EXCUSED").length;
    const total = present + absent + late + excused;

    const percentage = calculateAttendancePercentage(present, absent, late, excused);
    const status = getAttendanceStatus(percentage);

    summaries.push({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      quarter: studentRecords[0]?.quarter || "FIRST",
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      lateDays: late,
      excusedDays: excused,
      attendancePercentage: percentage,
      status,
    });
  }

  return summaries;
}

// Check if student attendance is flagged (below threshold)
export function isAttendanceFlagged(percentage: number, threshold: number = 85): boolean {
  return percentage < threshold;
}
