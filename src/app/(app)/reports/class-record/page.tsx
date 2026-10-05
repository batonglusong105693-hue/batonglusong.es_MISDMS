"use client";

import { useEffect, useState } from "react";
import { Download, FileText, AlertCircle, Loader2, Filter } from "lucide-react";

interface StudentGradeData {
  enrollmentId: string;
  lrn: string;
  firstName: string;
  lastName: string;
  q1Grade: number | null;
  q2Grade: number | null;
  q3Grade: number | null;
  q4Grade: number | null;
  finalGrade: number | null;
}

interface ClassRecordData {
  sectionName: string;
  gradeLevel: string;
  adviserName: string;
  academicYear: string;
  subjectName: string;
  quarter: string;
  students: StudentGradeData[];
  generatedAt: string;
}

export default function ClassRecordPage() {
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("FIRST");
  const [report, setReport] = useState<ClassRecordData | null>(null);
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
    const fetchData = async () => {
      try {
        const [secRes, subRes] = await Promise.all([
          fetch("/api/sections"),
          fetch("/api/subjects"),
        ]);
        const secData = await secRes.json();
        const subData = await subRes.json();
        setSections(secData.data || secData);
        setSubjects(subData.data || subData);
        if (secData.length > 0) setSelectedSection(secData[0].id);
        if (subData.length > 0) setSelectedSubject(subData[0].id);
      } catch (err) {
        setError("Failed to load data");
      }
    };
    fetchData();
  }, []);

  const handleGenerateReport = async () => {
    if (!selectedSection || !selectedSubject) {
      setError("Please select both section and subject");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetch(
        `/api/reports/class-record?sectionId=${selectedSection}&subjectId=${selectedSubject}&quarter=${selectedQuarter}`
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
    if (!selectedSection || !selectedSubject) return;

    try {
      setExporting(true);
      const res = await fetch(
        `/api/reports/class-record?sectionId=${selectedSection}&subjectId=${selectedSubject}&quarter=${selectedQuarter}&format=csv`
      );
      if (!res.ok) throw new Error("Failed to export");
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `class-record-${selectedSection}-${selectedQuarter}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const section = sections.find((s) => s.id === selectedSection);
  const subject = subjects.find((s) => s.id === selectedSubject);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Class Record (SF2)</h1>
          <p className="mt-1 text-sm text-slate-500">Generate and view class records with grades</p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
              disabled={loading || !selectedSection || !selectedSubject}
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

      {/* Report Display */}
      {report && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {report.subjectName} - {report.sectionName}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {report.adviserName} • {report.academicYear} • {quarters.find((q) => q.value === report.quarter)?.label}
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
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Q1</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Q2</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Q3</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Q4</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Final Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {report.students.map((student) => {
                    const finalGrade = student.finalGrade;
                    const gradeColor =
                      finalGrade === null
                        ? "text-slate-400"
                        : finalGrade >= 90
                          ? "text-green-600 font-bold"
                          : finalGrade >= 85
                            ? "text-blue-600 font-semibold"
                            : finalGrade >= 75
                              ? "text-yellow-600"
                              : "text-red-600";

                    return (
                      <tr key={student.enrollmentId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.lrn}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {student.lastName}, {student.firstName}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.q1Grade?.toFixed(2) || "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.q2Grade?.toFixed(2) || "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.q3Grade?.toFixed(2) || "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                          {student.q4Grade?.toFixed(2) || "—"}
                        </td>
                        <td className={`px-4 py-3 text-center text-sm ${gradeColor}`}>
                          {finalGrade !== null ? finalGrade.toFixed(2) : "—"}
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
