import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number to 2 decimal places (for grades)
 */
export function formatGrade(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(2);
}

/**
 * Format a date to Philippine standard format (e.g., "January 15, 2026")
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date with time (e.g., "January 15, 2026, 10:30 AM")
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Generate a full name from first/middle/last name
 */
export function formatFullName(student: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  extensionName?: string | null;
}): string {
  const middle = student.middleName ? ` ${student.middleName.charAt(0)}.` : "";
  const ext = student.extensionName ? ` ${student.extensionName}` : "";
  return `${student.lastName}, ${student.firstName}${middle}${ext}`;
}

/**
 * Compute DepEd quarterly grade
 * Weight: Written Works 30%, Performance Tasks 50%, Periodic Test 20%
 */
export function computeQuarterlyGrade(
  writtenWork: number | null,
  performanceTask: number | null,
  periodicTest: number | null
): number | null {
  if (
    writtenWork === null ||
    performanceTask === null ||
    periodicTest === null
  ) {
    return null;
  }
  return Math.round(
    writtenWork * 0.3 + performanceTask * 0.5 + periodicTest * 0.2
  );
}

/**
 * Compute final grade (average of available quarters)
 */
export function computeFinalGrade(
  q1: number | null,
  q2: number | null,
  q3: number | null,
  q4: number | null
): number | null {
  const quarters = [q1, q2, q3, q4].filter(
    (q): q is number => q !== null && q !== undefined
  );
  if (quarters.length === 0) return null;
  const sum = quarters.reduce((acc, q) => acc + q, 0);
  return Math.round((sum / quarters.length) * 100) / 100;
}

/**
 * Get remarks based on DepEd grading scale
 */
export function getRemarks(finalGrade: number | null): string {
  if (finalGrade === null) return "Pending";
  return finalGrade >= 75 ? "Passed" : "Failed";
}

/**
 * Convert numeric grade to DepEd descriptive equivalent
 */
export function getDescriptiveGrade(grade: number | null): string {
  if (grade === null) return "No Grade";
  if (grade >= 90) return "Outstanding";
  if (grade >= 85) return "Very Satisfactory";
  if (grade >= 80) return "Satisfactory";
  if (grade >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate a 12-digit Learner Reference Number (LRN)
 */
export function generateLRN(): string {
  // Format: 1 + 2-digit region + 2-digit division + 6-digit sequential + 1 check
  const region = "40"; // CALABARZON
  const division = "12"; // Batangas City
  const sequential = Math.floor(100000 + Math.random() * 900000);
  const check = Math.floor(Math.random() * 10);
  return `1${region}${division}${sequential}${check}`;
}

/**
 * Convert string to Title Case
 */
export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Check if a value is a valid email
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Get current academic year string (e.g., "2025-2026")
 */
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  // School year starts in June
  const startYear = now.getMonth() >= 5 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/**
 * Extract initials from a name for avatars
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Truncate a string
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.substring(0, length) + "...";
}