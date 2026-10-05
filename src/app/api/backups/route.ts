import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import {
  createBackup,
  listBackups,
  getBackupDetails,
  restoreBackup,
  deleteBackup,
  downloadBackup,
  formatFileSize,
  isValidBackupId,
} from "@/lib/backup-utils";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "backup:create")) {
    return forbiddenResponse("Insufficient permissions to create backups", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/backups",
    });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "create") {
      const metadata = await createBackup(session.user.id);
      return NextResponse.json({
        success: true,
        backup: {
          id: metadata.id,
          timestamp: metadata.timestamp,
          size: formatFileSize(metadata.size),
          tables: metadata.tables.length,
          records: Object.values(metadata.recordCounts).reduce((a, b) => a + b, 0),
          status: metadata.status,
          checksum: metadata.checksum,
        },
      });
    }

    if (action === "restore") {
      if (!hasPermission(session.user.role as Role, "backup:restore")) {
        return forbiddenResponse("Insufficient permissions to restore backups", {
          userId: session.user.id,
          action: "POST",
          resource: "/api/backups",
        });
      }

      const { backupId } = body;
      if (!isValidBackupId(backupId)) {
        return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
      }

      await restoreBackup(backupId, session.user.id);
      return NextResponse.json({
        success: true,
        message: "Backup restored successfully",
      });
    }

    if (action === "delete") {
      const { backupId } = body;
      if (!isValidBackupId(backupId)) {
        return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
      }

      await deleteBackup(backupId, session.user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Backup error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup operation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "backup:view")) {
    return forbiddenResponse("Insufficient permissions to view backups", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/backups",
    });
  }

  const { searchParams } = new URL(request.url);
  const backupId = searchParams.get("id");

  try {
    if (backupId) {
      // Get specific backup details
      if (!isValidBackupId(backupId)) {
        return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
      }

      const backup = await getBackupDetails(backupId);
      const tables = Object.keys(backup.data);
      const records = Object.values(backup.data).reduce(
        (sum: number, arr: any) =>
          sum + (Array.isArray(arr) ? arr.length : 0),
        0
      );

      return NextResponse.json({
        id: backup.metadata.id,
        timestamp: backup.metadata.timestamp,
        appVersion: backup.metadata.appVersion,
        tables,
        tableDetails: Object.entries(backup.data).map(([name, records]) => ({
          name,
          records: Array.isArray(records) ? records.length : 0,
        })),
        totalRecords: records,
      });
    }

    // List all backups
    const backups = await listBackups();
    return NextResponse.json({
      backups: backups.map((b) => ({
        id: b.id,
        timestamp: b.timestamp,
        size: formatFileSize(b.size),
        tables: b.tables,
        totalRecords: b.totalRecords,
        status: b.status,
      })),
    });
  } catch (err) {
    console.error("Backup retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve backups" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "backup:download")) {
    return forbiddenResponse("Insufficient permissions to download backups", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/backups",
    });
  }

  try {
    const body = await request.json();
    const { backupId } = body;

    if (!isValidBackupId(backupId)) {
      return NextResponse.json({ error: "Invalid backup ID" }, { status: 400 });
    }

    const buffer = await downloadBackup(backupId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backupId}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup download error:", err);
    return NextResponse.json(
      { error: "Failed to download backup" },
      { status: 500 }
    );
  }
}
