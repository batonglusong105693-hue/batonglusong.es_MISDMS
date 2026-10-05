import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import {
  checkAttendanceThreshold,
  checkLowGrades,
  checkEnrollmentCompletion,
  getAlertsByRole,
  getUnresolvedAlerts,
  resolveAlert,
  dismissAlert,
  createAlertRule,
  getAlertRules,
  deleteAlertRule,
  evaluateAlertRules,
  getAlertSummary,
  type AlertSeverity,
} from "@/lib/alerts-utils";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "alerts:view")) {
    return forbiddenResponse("Insufficient permissions to view alerts", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/alerts",
    });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "unresolved";
  const severity = searchParams.get("severity");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  try {
    if (view === "summary") {
      const summary = await getAlertSummary();
      return NextResponse.json(summary);
    }

    if (view === "unresolved") {
      const alerts = await getUnresolvedAlerts(limit);
      return NextResponse.json({
        view: "unresolved",
        count: alerts.length,
        alerts,
      });
    }

    if (view === "by_role") {
      const alerts = await getAlertsByRole(session.user.role, limit);
      return NextResponse.json({
        view: "by_role",
        role: session.user.role,
        count: alerts.length,
        alerts,
      });
    }

    if (view === "rules") {
      const rules = await getAlertRules();
      return NextResponse.json({
        view: "rules",
        rules,
      });
    }

    return badRequestResponse("Invalid view");
  } catch (err) {
    console.error("Alerts retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve alerts" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "alerts:manage")) {
    return forbiddenResponse("Insufficient permissions to manage alerts", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/alerts",
    });
  }

  try {
    const body = await request.json();
    const { action, alertId, notes, ruleName, condition, recipients } = body;

    if (action === "resolve") {
      if (!alertId) return badRequestResponse("Alert ID is required");

      await resolveAlert(alertId, session.user.id, notes);
      return NextResponse.json({
        success: true,
        message: "Alert resolved",
      });
    }

    if (action === "dismiss") {
      if (!alertId) return badRequestResponse("Alert ID is required");

      await dismissAlert(alertId, session.user.id);
      return NextResponse.json({
        success: true,
        message: "Alert dismissed",
      });
    }

    if (action === "create_rule") {
      if (!ruleName || !condition) {
        return badRequestResponse("Rule name and condition are required");
      }

      const rule = await createAlertRule(
        ruleName,
        condition,
        "NOTIFY",
        recipients || []
      );
      return NextResponse.json({
        success: true,
        rule,
      });
    }

    if (action === "delete_rule") {
      const { ruleId } = body;
      if (!ruleId) return badRequestResponse("Rule ID is required");

      await deleteAlertRule(ruleId);
      return NextResponse.json({
        success: true,
        message: "Rule deleted",
      });
    }

    if (action === "evaluate") {
      const alerts = await evaluateAlertRules();
      return NextResponse.json({
        success: true,
        alertsGenerated: alerts.length,
        alerts: alerts.slice(0, 50),
      });
    }

    return badRequestResponse("Invalid action");
  } catch (err) {
    console.error("Alert management error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Alert operation failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "alerts:view")) {
    return forbiddenResponse("Insufficient permissions", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/alerts",
    });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "check_attendance") {
      const threshold = body.threshold || 85;
      const alerts = await checkAttendanceThreshold(threshold);
      return NextResponse.json({
        check: "attendance",
        threshold,
        alertsFound: alerts.length,
        alerts: alerts.slice(0, 20),
      });
    }

    if (action === "check_grades") {
      const threshold = body.threshold || 70;
      const alerts = await checkLowGrades(threshold);
      return NextResponse.json({
        check: "grades",
        threshold,
        alertsFound: alerts.length,
        alerts: alerts.slice(0, 20),
      });
    }

    if (action === "check_enrollment") {
      const minPercent = body.minPercent || 80;
      const alerts = await checkEnrollmentCompletion(minPercent);
      return NextResponse.json({
        check: "enrollment",
        minPercent,
        alertsFound: alerts.length,
        alerts: alerts.slice(0, 20),
      });
    }

    return badRequestResponse("Invalid action");
  } catch (err) {
    console.error("Alert check error:", err);
    return NextResponse.json(
      { error: "Alert check failed" },
      { status: 500 }
    );
  }
}
