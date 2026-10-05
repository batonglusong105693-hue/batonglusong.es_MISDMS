"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface DashboardStats {
  students: { label: string; value: number; unit: string };
  faculty: { label: string; value: number; unit: string };
  sections: { label: string; value: number; unit: string };
  averageAttendance: { label: string; value: number; unit: string };
  averageGPA: { label: string; value: number; unit: string };
  enrollment: { label: string; value: number; unit: string };
}

interface AttendanceTrend {
  date: string;
  percentage: number;
  present: number;
  absent: number;
  late: number;
}

interface GradeTrend {
  quarter: string;
  averageGrade: number;
  passRate: number;
}

interface StudentPerformance {
  studentName: string;
  lrn: string;
  generalAverage: number;
  attendanceRate: number;
  status: string;
}

export default function AnalyticsDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [attendanceTrend, setAttendanceTrend] = useState<AttendanceTrend[]>([]);
  const [gradeTrend, setGradeTrend] = useState<GradeTrend[]>([]);
  const [topPerformers, setTopPerformers] = useState<StudentPerformance[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<StudentPerformance[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchAnalytics();
    }
  }, [session]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchAnalytics() {
    try {
      setLoading(true);
      setError(null);

      const sectionsResponse = await fetch("/api/sections?page=1&pageSize=1");
      const sectionsData = sectionsResponse.ok ? await sectionsResponse.json() : null;
      const sectionId = sectionsData?.data?.[0]?.id;
      const [dashStats, attTrend, grTrend] = await Promise.all([
          fetch("/api/analytics?metric=dashboard").then((r) => r.json()),
          fetch("/api/analytics?metric=attendance_trend&days=30").then((r) =>
            r.json()
          ),
          fetch("/api/analytics?metric=grade_trend").then((r) => r.json()),
        ]);
      const [topPerf, atRisk, gradeDist] = sectionId
        ? await Promise.all([
            fetch(`/api/analytics?metric=top_performers&sectionId=${sectionId}&limit=5`).then((r) => r.json()),
            fetch(`/api/analytics?metric=at_risk_students&sectionId=${sectionId}`).then((r) => r.json()),
            fetch(`/api/analytics?metric=grade_distribution&sectionId=${sectionId}`).then((r) => r.json()),
          ])
        : [{ data: [] }, { data: [] }, { data: {} }];

      setStats(dashStats);
      setAttendanceTrend(attTrend.data || []);
      setGradeTrend(grTrend.data || []);
      setTopPerformers(topPerf.data || []);
      setAtRiskStudents(atRisk.data || []);
      setGradeDistribution(gradeDist.data || {});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-2 text-gray-600">
            System-wide insights and performance metrics
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Key Metrics Grid */}
        {stats && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {[
              stats.students,
              stats.faculty,
              stats.sections,
              stats.averageAttendance,
              stats.averageGPA,
              stats.enrollment,
            ].map((metric, idx) => (
              <div
                key={idx}
                className="rounded-lg bg-white p-6 shadow"
              >
                <p className="text-sm text-gray-600">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {metric.value}
                </p>
                <p className="text-sm text-gray-500 mt-1">{metric.unit}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Attendance Trend */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Attendance Trend (30 Days)
            </h2>
            <div className="space-y-3">
              {attendanceTrend.slice(-7).map((trend, idx) => (
                <div key={idx} className="flex items-center">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{trend.date}</span>
                      <span className="font-medium text-gray-900">
                        {trend.percentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${trend.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grade Trend */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Grade Trend by Quarter
            </h2>
            <div className="space-y-4">
              {gradeTrend.map((trend, idx) => (
                <div key={idx} className="pb-4 border-b last:border-b-0">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {trend.quarter}
                    </span>
                    <span className="text-blue-600 font-semibold">
                      {trend.averageGrade.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Avg Grade: {trend.averageGrade.toFixed(2)}</div>
                    <div>Pass Rate: {trend.passRate.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
          {/* Grade Distribution */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Grade Distribution
            </h2>
            <div className="space-y-3">
              {Object.entries(gradeDistribution).map(([range, count]) => (
                <div key={range} className="flex items-center">
                  <div className="w-20 text-sm font-medium text-gray-700">
                    {range}
                  </div>
                  <div className="flex-1 h-8 bg-gray-200 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 to-green-600 flex items-center justify-end pr-2"
                      style={{
                        width: `${
                          (count /
                            Math.max(
                              ...Object.values(gradeDistribution)
                            )) *
                          100
                        }%`,
                      }}
                    >
                      <span className="text-xs font-bold text-white">
                        {count}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* At-Risk Students */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              At-Risk Students
            </h2>
            {atRiskStudents.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No at-risk students identified
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {atRiskStudents.map((student, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border-l-4 border-red-500 bg-red-50"
                  >
                    <p className="font-medium text-gray-900">
                      {student.studentName}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-2">
                      <div>GPA: {student.generalAverage.toFixed(2)}</div>
                      <div>Attendance: {student.attendanceRate.toFixed(1)}%</div>
                    </div>
                    <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-red-200 text-red-800 rounded">
                      {student.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Performers */}
        <div className="mt-8 rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Performers
          </h2>
          {topPerformers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No performance data available
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                      LRN
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                      GPA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                      Attendance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topPerformers.map((student, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {student.studentName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {student.lrn}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-green-600">
                        {student.generalAverage.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {student.attendanceRate.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 rounded-md bg-green-100 text-green-800 font-medium">
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={fetchAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </div>
  );
}
