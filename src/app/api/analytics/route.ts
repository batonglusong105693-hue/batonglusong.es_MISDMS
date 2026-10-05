import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import {
  getDashboardStats,
  getAttendanceTrend,
  getGradeTrend,
  getStudentPerformance,
  getEnrollmentTrend,
  getTopPerformers,
  getAtRiskStudents,
  getGradeDistribution,
  getAttendanceByStudent,
  calculateGradeStats,
} from "@/lib/analytics-utils";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "analytics:view")) {
    return forbiddenResponse("Insufficient permissions to view analytics", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/analytics",
    });
  }

  const { searchParams } = new URL(request.url);
  const metric = searchParams.get("metric");
  const sectionId = searchParams.get("sectionId");
  const days = searchParams.get("days") ? parseInt(searchParams.get("days")!) : 30;

  try {
    if (metric === "dashboard") {
      const stats = await getDashboardStats();
      return NextResponse.json(stats);
    }

    if (metric === "attendance_trend") {
      const trend = await getAttendanceTrend(days);
      return NextResponse.json({
        metric: "attendance_trend",
        days,
        data: trend,
        summary: {
          averageAttendance:
            trend.length > 0
              ? Math.round(
                  (trend.reduce((sum, t) => sum + t.percentage, 0) / trend.length) *
                    100
                ) / 100
              : 0,
        },
      });
    }

    if (metric === "grade_trend") {
      const trend = await getGradeTrend();
      return NextResponse.json({
        metric: "grade_trend",
        data: trend,
      });
    }

    if (metric === "student_performance") {
      if (!sectionId) return badRequestResponse("Section ID is required");

      const performance = await getStudentPerformance(sectionId);
      return NextResponse.json({
        metric: "student_performance",
        sectionId,
        data: performance,
        summary: {
          totalStudents: performance.length,
          averageGPA:
            performance.length > 0
              ? Math.round(
                  (performance.reduce((sum, p) => sum + p.generalAverage, 0) /
                    performance.length) *
                    100
                ) / 100
              : 0,
          averageAttendance:
            performance.length > 0
              ? Math.round(
                  (performance.reduce((sum, p) => sum + p.attendanceRate, 0) /
                    performance.length) *
                    100
                ) / 100
              : 0,
        },
      });
    }

    if (metric === "enrollment_trend") {
      const trend = await getEnrollmentTrend();
      return NextResponse.json({
        metric: "enrollment_trend",
        data: trend,
      });
    }

    if (metric === "top_performers") {
      if (!sectionId) return badRequestResponse("Section ID is required");

      const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 10;
      const performers = await getTopPerformers(sectionId, limit);
      return NextResponse.json({
        metric: "top_performers",
        sectionId,
        limit,
        data: performers,
      });
    }

    if (metric === "at_risk_students") {
      if (!sectionId) return badRequestResponse("Section ID is required");

      const students = await getAtRiskStudents(sectionId);
      return NextResponse.json({
        metric: "at_risk_students",
        sectionId,
        count: students.length,
        data: students,
      });
    }

    if (metric === "grade_distribution") {
      if (!sectionId) return badRequestResponse("Section ID is required");

      const distribution = await getGradeDistribution(sectionId);
      return NextResponse.json({
        metric: "grade_distribution",
        sectionId,
        data: distribution,
      });
    }

    if (metric === "attendance_by_student") {
      if (!sectionId) return badRequestResponse("Section ID is required");

      const attendance = await getAttendanceByStudent(sectionId);
      return NextResponse.json({
        metric: "attendance_by_student",
        sectionId,
        data: attendance,
      });
    }

    return badRequestResponse("Invalid metric");
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analytics failed" },
      { status: 500 }
    );
  }
}
