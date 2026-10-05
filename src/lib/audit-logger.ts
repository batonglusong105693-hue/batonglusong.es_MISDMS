import { prisma } from "./prisma";

export interface PermissionDenialLog {
  userId?: string;
  action: string;
  resource: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logPermissionDenial(log: PermissionDenialLog): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: "PERMISSION_DENIED",
        entityType: "AUTHORIZATION",
        entityId: log.userId || "UNKNOWN",
        details: {
          action: log.action,
          resource: log.resource,
          reason: log.reason,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          timestamp: new Date().toISOString(),
        },
        performedById: log.userId,
        ipAddress: log.ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log permission denial:", error);
  }
}
