// Settings management utilities for system configuration

import { prisma } from "@/lib/prisma";

export type SettingKey =
  | "school_name"
  | "school_address"
  | "school_contact"
  | "school_email"
  | "academic_year"
  | "academic_year_mode"
  | "manual_academic_year"
  | "current_quarter"
  | "max_section_capacity"
  | "attendance_threshold_good"
  | "attendance_threshold_warning"
  | "grading_scale_excellent"
  | "grading_scale_good"
  | "grading_scale_satisfactory"
  | "grading_scale_needs_improvement"
  | "enable_email_notifications"
  | "enable_sms_notifications"
  | "maintenance_mode"
  | "backup_frequency";

export interface SystemSetting {
  id: string;
  key: SettingKey;
  value: string;
  description: string;
  category: "school" | "academic" | "system" | "notifications" | "grading";
  dataType: "string" | "number" | "boolean" | "json";
  updatedAt: Date;
  updatedById: string;
}

export interface SettingCategory {
  name: string;
  description: string;
  settings: SystemSetting[];
}

const DEFAULT_SETTINGS: Record<SettingKey, { value: string; description: string; dataType: string; category: string }> = {
  school_name: {
    value: "Batong Lusong Elementary School",
    description: "Official school name",
    dataType: "string",
    category: "school",
  },
  school_address: {
    value: "Zone 3, Sitio Batong Lusong, Brgy. Villa Floresta, San Jose City",
    description: "School address",
    dataType: "string",
    category: "school",
  },
  school_contact: {
    value: "+63-917-720-9884",
    description: "School contact number",
    dataType: "string",
    category: "school",
  },
  school_email: {
    value: "105693@deped.gov.ph",
    description: "School email address",
    dataType: "string",
    category: "school",
  },
  academic_year: {
    value: "2026-2027",
    description: "Current academic year",
    dataType: "string",
    category: "academic",
  },
  academic_year_mode: {
    value: "automatic",
    description: "Academic year mode: automatic or manual",
    dataType: "string",
    category: "academic",
  },
  manual_academic_year: {
    value: "",
    description: "Manual academic year override when automatic mode is disabled",
    dataType: "string",
    category: "academic",
  },
  current_quarter: {
    value: "FIRST",
    description: "Current school quarter (FIRST, SECOND, THIRD, FOURTH)",
    dataType: "string",
    category: "academic",
  },
  max_section_capacity: {
    value: "50",
    description: "Maximum students per section",
    dataType: "number",
    category: "academic",
  },
  attendance_threshold_good: {
    value: "90",
    description: "Attendance percentage for GOOD status (≥)",
    dataType: "number",
    category: "academic",
  },
  attendance_threshold_warning: {
    value: "85",
    description: "Attendance percentage for WARNING status (≥)",
    dataType: "number",
    category: "academic",
  },
  grading_scale_excellent: {
    value: "90",
    description: "Grade threshold for Excellent (≥)",
    dataType: "number",
    category: "grading",
  },
  grading_scale_good: {
    value: "85",
    description: "Grade threshold for Good (≥)",
    dataType: "number",
    category: "grading",
  },
  grading_scale_satisfactory: {
    value: "80",
    description: "Grade threshold for Satisfactory (≥)",
    dataType: "number",
    category: "grading",
  },
  grading_scale_needs_improvement: {
    value: "75",
    description: "Grade threshold for Needs Improvement (≥)",
    dataType: "number",
    category: "grading",
  },
  enable_email_notifications: {
    value: "true",
    description: "Enable email notifications",
    dataType: "boolean",
    category: "notifications",
  },
  enable_sms_notifications: {
    value: "false",
    description: "Enable SMS notifications",
    dataType: "boolean",
    category: "notifications",
  },
  maintenance_mode: {
    value: "false",
    description: "Enable maintenance mode (disables access)",
    dataType: "boolean",
    category: "system",
  },
  backup_frequency: {
    value: "daily",
    description: "Backup frequency (hourly, daily, weekly)",
    dataType: "string",
    category: "system",
  },
};

export async function getSetting(key: SettingKey): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value || null;
  } catch (err) {
    console.error(`Error fetching setting ${key}:`, err);
    return null;
  }
}

export async function getAllSettings(): Promise<SystemSetting[]> {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: [{ category: "asc" }, { key: "asc" }],
      include: {
        updatedBy: { select: { name: true } },
      },
    });
    return settings as any;
  } catch (err) {
    console.error("Error fetching settings:", err);
    return [];
  }
}

export async function getSettingsByCategory(
  category: "school" | "academic" | "system" | "notifications" | "grading"
): Promise<SystemSetting[]> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { category },
      orderBy: { key: "asc" },
    });
    return settings as any;
  } catch (err) {
    console.error(`Error fetching ${category} settings:`, err);
    return [];
  }
}

export async function updateSetting(
  key: SettingKey,
  value: string,
  userId: string
): Promise<SystemSetting | null> {
  try {
    const setting = await prisma.systemSetting.update({
      where: { key },
      data: {
        value,
        updatedById: userId,
        updatedAt: new Date(),
      },
    });
    return setting as any;
  } catch (err) {
    console.error(`Error updating setting ${key}:`, err);
    return null;
  }
}

export async function initializeDefaultSettings(): Promise<void> {
  try {
    const systemUser = await prisma.user.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!systemUser) return;

    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await prisma.systemSetting.findUnique({
        where: { key: key as SettingKey },
      });

      if (!existing) {
        await prisma.systemSetting.create({
          data: {
            key: key as SettingKey,
            value: config.value,
            description: config.description,
            category: config.category as any,
            dataType: config.dataType as any,
            updatedById: systemUser.id,
          },
        });
      }
    }
  } catch (err) {
    console.error("Error initializing default settings:", err);
  }
}

export function validateSettingValue(
  key: SettingKey,
  value: string
): { valid: boolean; error?: string } {
  const config = DEFAULT_SETTINGS[key];
  if (!config) {
    return { valid: false, error: "Unknown setting key" };
  }

  if (config.dataType === "number") {
    const num = parseFloat(value);
    if (isNaN(num)) {
      return { valid: false, error: `${key} must be a number` };
    }
    if (key.includes("threshold") && (num < 0 || num > 100)) {
      return { valid: false, error: `${key} must be between 0 and 100` };
    }
    if (key === "max_section_capacity" && num < 1) {
      return { valid: false, error: "Max capacity must be at least 1" };
    }
  }

  if (config.dataType === "boolean") {
    if (!["true", "false"].includes(value.toLowerCase())) {
      return { valid: false, error: `${key} must be true or false` };
    }
  }

  if (key === "current_quarter") {
    if (!["FIRST", "SECOND", "THIRD", "FOURTH"].includes(value)) {
      return { valid: false, error: "Quarter must be FIRST, SECOND, THIRD, or FOURTH" };
    }
  }

  if (key === "backup_frequency") {
    if (!["hourly", "daily", "weekly"].includes(value)) {
      return { valid: false, error: "Backup frequency must be hourly, daily, or weekly" };
    }
  }

  return { valid: true };
}

export function convertSettingValue(value: string, dataType: string): string | number | boolean | object {
  if (dataType === "number") return parseFloat(value);
  if (dataType === "boolean") return value.toLowerCase() === "true";
  if (dataType === "json") return JSON.parse(value);
  return value;
}
