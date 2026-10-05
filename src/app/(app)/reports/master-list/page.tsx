"use client";

import { useEffect, useState } from "react";
import { Download, FileText, AlertCircle, Loader2, Filter } from "lucide-react";

interface StudentAttendanceData {
  enrollmentId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendancePercentage: number;
  attendanceStatus: "GOOD" | "WARNING" | "POOR";
}

interface MasterListData {
  sectionName: string;
  gradeLevel: string;
  adviserName: string;
  academicYear: string;
  students: StudentAttendanceData[];
  generatedAt: string;
}

const STATUS_COLORS: Record<string, { badge: string; bar: string }> = {
  GOOD: { badge: "bg-green-100 text-green-800", bar: "bg-green-500" },
  WARNING: { badge: "bg-yellow-100 text-yellow-800", bar: "bg-yellow-500" },
  POOR: { badge: "bg-red-100 text-red-800", bar: "bg-red-500" },
};

export default function MasterListPage() {
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("FIRST");
  const [report, setReport] = useState<MasterListData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const quarters = [
    { value: "FIRST", label: "Q1 (June-August)" },
    { value: "SECOND", label: "Q2 (September-November)" },
    { value: "THIRD", label: "Q3 (December-February)" },
    { value: "FOURTH", label: "Q4 (March-May)" },
  ];

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch("/api/sections");
        const data = await res.json();
        setSections(data.data || data);
        if (data.length > 0) setSelectedSection(data[0].id);
      } catch (err) {
        setError("Failed to load sections");
      }
    };
    fetchSections();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedSection) {
      setError("Please select a section");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch(
        `/api/reports/master-list?sectionId=${selectedSection}&quarter=${selectedQuarter}`
      );
      if (!res.ok) throw new Error("Failed to generate report");
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!selectedSection) return;

    try {
      setExporting(true);
      const res = await fetch(
        `/api/reports/master-list?sectionId=${selectedSection}&quarter=${selectedQuarter}&format=csv`
      );
      if (!res.ok) throw new Error("Failed to export");
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master-list-${selectedSection}-${selectedQuarter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const section = sections.find((s) => s.id === selectedSection);

  // Statistics
  const statistics = report
    ? {
        totalStudents: report.students.length,
        avgAttendance: Math.round(
          report.students.reduce((sum, s) => sum + s.attendancePercentage, 0) / report.students.length
        ),
        goodCount: report.students.filter((s) => s.attendanceStatus === "GOOD").length,
        warningCount: report.students.filter((s) => s.attendanceStatus === "WARNING").length,
        poorCount: report.students.filter((s) => s.attendanceStatus === "POOR").length,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Master List (SF1)</h1>
          <p className="mt-1 text-sm text-slate-500">Generate and view attendance records by section</p>
        </div>
        <FileText className="h-8 w-8 text-blue-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Report Filters</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
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

          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={loading || !selectedSection}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Total Students</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">{statistics.totalStudents}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Average Attendance</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">{statistics.avgAttendance}%</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Good</div>
            <div className="mt-2 text-3xl font-bold text-green-600">{statistics.goodCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Warning</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">{statistics.warningCount}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-600">Poor</div>
            <div className="mt-2 text-3xl font-bold text-red-600">{statistics.poorCount}</div>
          </div>
        </div>
      )}

      {/* Report Display */}
      {report && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{report.sectionName} - Attendance Record</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {report.adviserName} • {report.academicYear} • {quarters.find((q) => q.value === selectedQuarter)?.label}
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">LRN</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student Name</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Present</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Absent</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Late</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Excused</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Attendance %</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((student) => {
                    const colors = STATUS_COLORS[student.attendanceStatus];
                    return (
                      <tr key={student.enrollmentId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.lrn}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {student.lastName}, {student.firstName}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-green-600">
                          {student.presentDays}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-red-600">
                          {student.absentDays}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-yellow-600">
                          {student.lateDays}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-blue-600">
                          {student.excusedDays}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm font-bold text-slate-900">{student.attendancePercentage}%</div>
                          <div className="mt-1 h-1.5 w-12 rounded-full bg-slate-200 mx-auto">
                            <div
                              className={`h-full rounded-full ${colors.bar}`}
                              style={{ width: `${student.attendancePercentage}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}>
                            {student.attendanceStatus}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-lg bg-blue-50 p-4">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Generated:</span> {new Date(report.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
