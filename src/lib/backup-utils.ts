import { prisma } from "./prisma";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as crypto from "crypto";

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  size: number;
  tables: string[];
  recordCounts: Record<string, number>;
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS";
  createdBy: string;
  compressed: boolean;
  checksum: string;
}

export interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  tables: number;
  totalRecords: number;
  status: string;
}

const BACKUP_DIR = path.join(process.cwd(), "backups");

export async function initializeBackupDir(): Promise<void> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export async function createBackup(userId: string): Promise<BackupMetadata> {
  await initializeBackupDir();

  const backupId = `backup_${Date.now()}`;
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);

  try {
    const data: Record<string, any> = {};
    const recordCounts: Record<string, number> = {};

    // Backup all tables
    const tables = [
      "academicYear",
      "section",
      "student",
      "user",
      "enrollment",
      "subject",
      "grade",
      "attendanceRecord",
      "document",
      "notification",
      "auditLog",
    ];

    for (const table of tables) {
      const model = (prisma as any)[table];
      if (model) {
        data[table] = await model.findMany();
        recordCounts[table] = data[table].length;
      }
    }

    const backupData = {
      metadata: {
        id: backupId,
        timestamp: new Date(),
        version: "1.0",
        appVersion: "MISDMS-BLES v1.0",
      },
      data,
    };

    // Write backup
    const jsonContent = JSON.stringify(backupData, null, 2);
    fs.writeFileSync(backupPath, jsonContent);

    const stats = fs.statSync(backupPath);
    const checksum = calculateChecksum(jsonContent);

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      size: stats.size,
      tables,
      recordCounts,
      status: "COMPLETED",
      createdBy: userId,
      compressed: false,
      checksum,
    };

    // Log backup in database
    await prisma.auditLog.create({
      data: {
        action: "BACKUP_CREATED",
        entityType: "BACKUP",
        entityId: backupId,
        details: { recordCounts },
        performedById: userId,
      },
    });

    return metadata;
  } catch (err) {
    console.error("Backup creation error:", err);
    throw new Error("Failed to create backup");
  }
}

export async function compressBackup(backupId: string): Promise<string> {
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);
  const compressedPath = path.join(BACKUP_DIR, `${backupId}.gz`);

  return new Promise((resolve, reject) => {
    const gzip = zlib.createGzip();
    const source = fs.createReadStream(backupPath);
    const destination = fs.createWriteStream(compressedPath);

    source
      .pipe(gzip)
      .pipe(destination)
      .on("finish", () => resolve(compressedPath))
      .on("error", reject);
  });
}

export async function listBackups(): Promise<BackupInfo[]> {
  await initializeBackupDir();

  const files = fs.readdirSync(BACKUP_DIR);
  const backups: BackupInfo[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    try {
      const filePath = path.join(BACKUP_DIR, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const backup = JSON.parse(content);

      const stats = fs.statSync(filePath);
      const totalRecords = Object.values(backup.data).reduce(
        (sum: number, records: any) =>
          sum + (Array.isArray(records) ? records.length : 0),
        0
      );

      backups.push({
        id: backup.metadata.id,
        timestamp: new Date(backup.metadata.timestamp),
        size: stats.size,
        tables: Object.keys(backup.data).length,
        totalRecords,
        status: "COMPLETED",
      });
    } catch (err) {
      console.error(`Error reading backup ${file}:`, err);
    }
  }

  return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function getBackupDetails(backupId: string): Promise<any> {
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);

  if (!fs.existsSync(backupPath)) {
    throw new Error("Backup not found");
  }

  try {
    const content = fs.readFileSync(backupPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to read backup");
  }
}

export async function restoreBackup(backupId: string, userId: string): Promise<void> {
  try {
    const backup = await getBackupDetails(backupId);

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Delete children before parents so foreign-key constraints remain valid.
      const tables = Object.keys(backup.data);

      for (const table of [...tables].reverse()) {
        const model = (tx as any)[table];
        if (model) {
          await model.deleteMany();
        }
      }

      // Restore data
      for (const [table, records] of Object.entries(backup.data)) {
        const model = (tx as any)[table];
        if (model && Array.isArray(records)) {
          for (const record of records) {
            await model.create({ data: record });
          }
        }
      }
    });

    // Log restoration
    await prisma.auditLog.create({
      data: {
        action: "BACKUP_RESTORED",
        entityType: "BACKUP",
        entityId: backupId,
        details: { tables: Object.keys(backup.data) },
        performedById: userId,
      },
    });
  } catch (err) {
    console.error("Backup restoration error:", err);
    throw new Error("Failed to restore backup");
  }
}

export async function deleteBackup(backupId: string, userId: string): Promise<void> {
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);
  const compressedPath = path.join(BACKUP_DIR, `${backupId}.gz`);

  try {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    if (fs.existsSync(compressedPath)) {
      fs.unlinkSync(compressedPath);
    }

    await prisma.auditLog.create({
      data: {
        action: "BACKUP_DELETED",
        entityType: "BACKUP",
        entityId: backupId,
        resource: `backup:${backupId}`,
        details: { message: "Backup deleted", userId },
      },
    }).catch(() => {});
  } catch (err) {
    console.error("Backup deletion error:", err);
    throw new Error("Failed to delete backup");
  }
}

export async function downloadBackup(backupId: string): Promise<Buffer> {
  const backupPath = path.join(BACKUP_DIR, `${backupId}.json`);

  if (!fs.existsSync(backupPath)) {
    throw new Error("Backup not found");
  }

  return fs.readFileSync(backupPath);
}

export function calculateChecksum(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function isValidBackupId(backupId: string): boolean {
  return /^backup_\d{13}$/.test(backupId);
}
