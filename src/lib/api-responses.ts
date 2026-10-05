import { NextResponse } from "next/server";
import { logPermissionDenial } from "./audit-logger";

export interface AuthErrorOptions {
  userId?: string;
  action?: string;
  resource?: string;
  ipAddress?: string;
  userAgent?: string;
}

export function forbiddenResponse(
  message: string = "Forbidden: insufficient permissions",
  options?: AuthErrorOptions
) {
  if (options?.userId) {
    logPermissionDenial({
      userId: options.userId,
      action: options.action || "UNKNOWN",
      resource: options.resource || "UNKNOWN",
      reason: message,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
    }).catch(console.error);
  }

  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function notFoundResponse(resource: string = "Resource") {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflictResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 409 });
}
