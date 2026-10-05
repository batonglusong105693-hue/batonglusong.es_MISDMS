"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download, AlertCircle, Loader2 } from "lucide-react";

interface AttendanceSummary {
  studentId: string;
  studentName: string;
  quarter: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
  status: "GOOD" | "WARNING" | "POOR";
}

const STATUS_BADGE: Record<string, { bg: string; text: string; icon: string }> = {
  GOOD: { bg: "bg-green-100", text: "text-green-800", icon: "✓" },
  WARNING: { bg: "bg-yellow-100", text: "text-yellow-800", icon: "!" },
  POOR: { bg: "bg-red-100", text: "text-red-800", icon: "✗" },
};

export default function AttendanceReportsPage() {
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("FIRST");
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const quarters = [
    { value: "FIRST", label: "Q1 (June-August)" },
    { value: "SECOND", label: "Q2 (September-November)" },
    { value: "THIRD", label: "Q3 (December-February)" },
    { value: "FOURTH", label: "Q4 (March-May)" },
  ];

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch("/api/sections");
        if (!res.ok) throw new Error("Failed to fetch sections");
        const data = await res.json();
        setSections(data);
        if (data.length > 0) {
          setSelectedSection(data[0].id);
        }
      } catch (err) {
        setError("Failed to load sections");
      }
    };

    fetchSections();
  }, []);

  // Fetch attendance summary
  useEffect(() => {
    const fetchSummary = async () => {
      if (!selectedSection) return;

      try {
        setLoading(true);
        const res = await fetch(
          `/api/attendance/summary?sectionId=${selectedSection}&quarter=${selectedQuarter}`
        );
        if (!res.ok) throw new Error("Failed to fetch summary");
        const data = await res.json();
        setSummaries(data);
      } catch (err) {
        setError("Failed to load attendance summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [selectedSection, selectedQuarter]);

  const handleExportCSV = () => {
    if (summaries.length === 0) return;

    setExporting(true);
    try {
      const headers = [
        "Student Name",
        "Total Days",
        "Present",
        "Absent",
        "Late",
        "Excused",
        "Attendance %",
        "Status",
      ];

      const rows = summaries.map((s) => [
        s.studentName,
        s.totalDays,
        s.presentDays,
        s.absentDays,
        s.lateDays,
        s.excusedDays,
        s.attendancePercentage,
        s.status,
      ]);

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-${selectedSection}-${selectedQuarter}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const section = sections.find((s) => s.id === selectedSection);
  const quarterLabel = quarters.find((q) => q.value === selectedQuarter)?.label;

  // Statistics
  const avgAttendance =
    summaries.length > 0
      ? Math.round(
          summaries.reduce((sum, s) => sum + s.attendancePercentage, 0) / summaries.length
        )
      : 0;

  const flaggedStudents = summaries.filter((s) => s.status === "POOR").length;
  const warningStudents = summaries.filter((s) => s.status === "WARNING").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Attendance Reports</h1>
          <p className="mt-1 text-sm text-slate-500">View and analyze attendance data</p>
        </div>
        <BarChart3 className="h-8 w-8 text-blue-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a section...</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} - Grade {s.gradeLevel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Quarter</label>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {quarters.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      {section && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Total Students</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{summaries.length}</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Average Attendance</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{avgAttendance}%</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Warning</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{warningStudents}</div>
            <p className="mt-1 text-xs text-slate-500">&lt;90% attendance</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Critical</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{flaggedStudents}</div>
            <p className="mt-1 text-xs text-slate-500">&lt;85% attendance</p>
          </div>
        </div>
      )}

      {/* Export Button */}
      {summaries.length > 0 && (
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Download className="h-4 w-4" />
          Export as CSV
        </button>
      )}

      {/* Attendance Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">No attendance data available for this selection</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Total Days</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Present</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Absent</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Late</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Excused</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Attendance %</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((summary) => {
                  const badge = STATUS_BADGE[summary.status];
                  return (
                    <tr key={summary.studentId} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">{summary.studentName}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">{summary.totalDays}</td>
                      <td className="px-4 py-3 text-center text-sm text-green-600 font-medium">
                        {summary.presentDays}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-red-600 font-medium">
                        {summary.absentDays}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-yellow-600 font-medium">
                        {summary.lateDays}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-blue-600 font-medium">
                        {summary.excusedDays}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-sm font-bold text-slate-900">{summary.attendancePercentage}%</div>
                        <div className="mt-1 h-1.5 w-16 mx-auto rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full ${
                              summary.attendancePercentage >= 90
                                ? "bg-green-500"
                                : summary.attendancePercentage >= 85
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${summary.attendancePercentage}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            badge.bg
                          } ${badge.text}`}
                        >
                          {badge.icon} {summary.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900">Status Legend</h3>
        <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-blue-800 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            GOOD: ≥90% attendance
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
            WARNING: 85-89% attendance
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            POOR: &lt;85% attendance
          </div>
        </div>
      </div>
    </div>
  );
}
