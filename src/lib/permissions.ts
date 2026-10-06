export interface RolePermissionConfig {
  label: string;
  routes: string[];
  permissions: string[];
}

export const rolePermissions: Record<string, RolePermissionConfig> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    routes: [],
    permissions: [
      "student:manage",
      "faculty:manage",
      "section:manage",
      "enrollment:manage",
      "grade:manage",
      "grade:workflow",
      "document:manage",
      "document:approve",
      "document:release",
      "inventory:view",
      "inventory:manage",
      "audit:view",
      "alerts:view",
      "alerts:manage",
      "settings:view",
      "settings:manage",
      "analytics:view",
      "attendance:view",
      "attendance:manage",
      "reports:view",
      "reports:generate",
      "reports:manage",
      "backup:create",
      "backup:restore",
      "backup:delete",
      "backup:view",
      "backup:download",
      "export:data",
      "file:upload",
      "file:view",
      "file:manage",
      "search:data",
      "notification:send",
      "notification:view",
    ],
  },
  PRINCIPAL: {
    label: "Principal",
    routes: [
      "/dashboard",
      "/students",
      "/faculty",
      "/sections",
      "/enrollment",
      "/documents",
      "/audit-logs",
      "/alerts",
      "/inventory",
      "/grades/workflow",
      "/attendance",
      "/reports",
      "/analytics",
      "/export",
    ],
    permissions: [
      "student:view",
      "faculty:view",
      "section:view",
      "enrollment:view",
      "grade:view",
      "grade:workflow",
      "document:manage",
      "document:approve",
      "document:release",
      "inventory:view",
      "inventory:manage",
      "audit:view",
      "alerts:view",
      "alerts:manage",
      "analytics:view",
      "attendance:view",
      "attendance:manage",
      "reports:view",
      "reports:generate",
      "export:data",
      "file:view",
      "search:data",
    ],
  },
  ADMIN_OFFICER: {
    label: "Administrative Officer",
    routes: [
      "/dashboard",
      "/students",
      "/faculty",
      "/enrollment",
      "/documents",
      "/sections",
      "/alerts",
      "/inventory",
      "/files",
      "/settings",
      "/grades/workflow",
      "/attendance",
      "/reports",
      "/analytics",
      "/export",
    ],
    permissions: [
      "student:manage",
      "student:view",
      "faculty:view",
      "section:view",
      "enrollment:manage",
      "grade:view",
      "grade:workflow",
      "document:manage",
      "document:release",
      "inventory:view",
      "inventory:manage",
      "reports:generate",
      "alerts:view",
      "alerts:manage",
      "analytics:view",
      "attendance:view",
      "reports:view",
      "reports:generate",
      "reports:manage",
      "export:data",
      "file:view",
      "file:upload",
      "file:manage",
      "settings:view",
      "settings:manage",
      "notification:view",
      "notification:send",
      "search:data",
    ],
  },
  TEACHER: {
    label: "Teacher",
    routes: [
      "/dashboard",
      "/my-students",
      "/documents",
      "/alerts",
      "/attendance",
      "/attendance/reports",
      "/grading",
      "/reports",
      "/search",
    ],
    permissions: [
      "document:view",
      "alerts:view",
      "attendance:view",
      "attendance:manage",
      "grade:view",
      "grade:manage",
      "reports:view",
      "reports:generate",
      "search:data",
    ],
  },
  ADVISER: {
    label: "Adviser",
    routes: [
      "/dashboard",
      "/my-students",
      "/documents",
      "/alerts",
      "/attendance",
      "/attendance/reports",
      "/grading",
      "/reports",
      "/search",
    ],
    permissions: [
      "document:view",
      "alerts:view",
      "attendance:view",
      "attendance:manage",
      "grade:view",
      "grade:manage",
      "reports:view",
      "reports:generate",
      "search:data",
    ],
  },
  ADMIN_SUPPORT: {
    label: "Administrative Support Staff",
    routes: ["/dashboard", "/documents", "/inventory", "/files", "/search"],
    permissions: [
      "document:view",
      "inventory:view",
      "file:view",
      "file:upload",
      "search:data",
    ],
  },
};

export type Role = keyof typeof rolePermissions;

export function hasPermission(role: Role, permission: string): boolean {
  const config = rolePermissions[role];
  if (!config) return false;
  if (role === "SUPER_ADMIN") return true;
  const aliases: Record<string, string> = {
    "report:view": "reports:view",
    "reports:view": "reports:view",
    "grades:view": "grade:view",
    "grades:manage": "grade:manage",
    "grade:view": "grade:view",
    "grade:manage": "grade:manage",
  };
  return config.permissions.includes(permission) || config.permissions.includes(aliases[permission]);
}

export function canAccessRoute(role: Role, pathname: string): boolean {
  if (role === "SUPER_ADMIN") return true;
  const config = rolePermissions[role];
  if (!config) return false;
  return config.routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function requirePermission(role: Role | undefined, permission: string): boolean {
  if (!role) return false;
  return hasPermission(role as Role, permission);
}