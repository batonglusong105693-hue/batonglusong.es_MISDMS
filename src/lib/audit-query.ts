// Audit log query and filtering utilities

import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "READ"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "PERMISSION_DENIED"
  | "EXPORT"
  | "IMPORT"
  | "BACKUP"
  | "RESTORE";

export interface AuditLogFilter {
  action?: AuditAction;
  resource?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}

export interface AuditLogResponse {
  logs: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditSummary {
  totalActions: number;
  actionsByType: Record<AuditAction, number>;
  actionsByUser: Record<string, number>;
  actionsByResource: Record<string, number>;
  recentActions: any[];
  failedAttempts: number;
}

export async function queryAuditLogs(filter: AuditLogFilter): Promise<AuditLogResponse> {
  const page = filter.page || 1;
  const pageSize = Math.min(filter.pageSize || 50, 100);
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (filter.action) {
    where.action = filter.action;
  }

  if (filter.resource) {
    where.entityType = {
      contains: filter.resource,
      mode: "insensitive",
    };
  }

  if (filter.userId) {
    where.performedById = filter.userId;
  }

  if (filter.startDate || filter.endDate) {
    where.timestamp = {};
    if (filter.startDate) {
      where.timestamp.gte = filter.startDate;
    }
    if (filter.endDate) {
      where.timestamp.lte = filter.endDate;
    }
  }

  if (filter.searchTerm) {
    where.OR = [
      { entityType: { contains: filter.searchTerm, mode: "insensitive" } },
      { details: { contains: filter.searchTerm, mode: "insensitive" } },
      { performedBy: { name: { contains: filter.searchTerm, mode: "insensitive" } } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { timestamp: "desc" },
      include: {
        performedBy: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getAuditSummary(days: number = 7): Promise<AuditSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await prisma.auditLog.findMany({
    where: {
      timestamp: { gte: startDate },
    },
    include: {
      performedBy: { select: { name: true } },
    },
  });

  const actionsByType: Record<AuditAction, number> = {} as any;
  const actionsByUser: Record<string, number> = {};
  const actionsByResource: Record<string, number> = {};
  let failedAttempts = 0;

  for (const log of logs) {
    // Count by action
    actionsByType[log.action as AuditAction] = (actionsByType[log.action as AuditAction] || 0) + 1;

    // Count by user
    const userName = log.performedBy?.name || "Unknown";
    actionsByUser[userName] = (actionsByUser[userName] || 0) + 1;

    // Count by resource
    actionsByResource[log.entityType] = (actionsByResource[log.entityType] || 0) + 1;

    // Count failed attempts
    if (log.action === "PERMISSION_DENIED") {
      failedAttempts++;
    }
  }

  const recentActions = logs.slice(0, 10);

  return {
    totalActions: logs.length,
    actionsByType,
    actionsByUser,
    actionsByResource,
    recentActions,
    failedAttempts,
  };
}

export async function getActionsByUser(userId: string, days: number = 30): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.auditLog.findMany({
    where: {
      performedById: userId,
      timestamp: { gte: startDate },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });
}

export async function getActionsByResource(resource: string, days: number = 30): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.auditLog.findMany({
    where: {
      entityType: {
        contains: resource,
        mode: "insensitive",
      },
      timestamp: { gte: startDate },
    },
    orderBy: { timestamp: "desc" },
    include: {
      performedBy: { select: { name: true, email: true } },
    },
    take: 100,
  });
}

export async function getFailedAttempts(days: number = 7): Promise<any[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.auditLog.findMany({
    where: {
      action: "PERMISSION_DENIED",
      timestamp: { gte: startDate },
    },
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  });
}

export function formatLogEntry(log: any): string {
  const timestamp = new Date(log.timestamp).toLocaleString();
  const userName = log.performedBy?.name || "Unknown User";
  return `[${timestamp}] ${userName} - ${log.action} on ${log.entityType}`;
}

export function groupLogsByDate(logs: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const log of logs) {
    const date = new Date(log.timestamp).toLocaleDateString();
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(log);
  }

  return grouped;
}
