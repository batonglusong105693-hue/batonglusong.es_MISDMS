"use client";

import { useEffect, useState } from "react";
import { Search, FileCheck2, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface GradeEntry {
  id: string;
  enrollment: {
    id: string;
    student: { lrn: string; firstName: string; lastName: string };
    section: { name: string; gradeLevel: string } | null;
  };
  subject: { id: string; name: string; shortName: string | null };
  q1WrittenWork: number | null;
  q1PerformanceTask: number | null;
  q1PeriodicTest: number | null;
  q1Grade: number | null;
  q2WrittenWork: number | null;
  q2PerformanceTask: number | null;
  q2PeriodicTest: number | null;
  q2Grade: number | null;
  q3WrittenWork: number | null;
  q3PerformanceTask: number | null;
  q3PeriodicTest: number | null;
  q3Grade: number | null;
  q4WrittenWork: number | null;
  q4PerformanceTask: number | null;
  q4PeriodicTest: number | null;
  q4Grade: number | null;
  finalGrade: number | null;
  remarks: string | null;
  canEdit: boolean;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export default function GradingPage() {
  const { showToast } = useToast();
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/grades")
      .then((res) => res.json())
      .then((data: PaginatedResponse<GradeEntry> | GradeEntry[]) => {
        setGrades(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = grades.filter((g) =>
    `${g.enrollment.student.lrn} ${g.enrollment.student.firstName} ${g.enrollment.student.lastName} ${g.subject.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  // DepEd computation: 30% Written Works + 50% Performance Tasks + 20% Periodic Test
  const computeQuarter = (ww: number | null, pt: number | null, pe: number | null) => {
    if (ww === null || pt === null || pe === null) return null;
    return Math.round((ww * 0.3 + pt * 0.5 + pe * 0.2) * 100) / 100;
  };

  const updateGrade = async (grade: GradeEntry, field: string, value: string) => {
    if (!grade.canEdit) return;
    const num = value === "" ? null : Math.max(0, Math.min(100, Number(value)));
    setSaving((s) => ({ ...s, [grade.id]: true }));

    // Update locally
    setGrades((gs) =>
      gs.map((g) => {
        if (g.id !== grade.id) return g;
        const updated = { ...g, [field]: num as any };

        // Recompute affected quarter
        const q = field.substring(0, 2) as string;
        if (q === "q1" || q === "q2" || q === "q3" || q === "q4") {
          const ww = updated[`${q}WrittenWork` as keyof GradeEntry] as number | null;
          const pt = updated[`${q}PerformanceTask` as keyof GradeEntry] as number | null;
          const pe = updated[`${q}PeriodicTest` as keyof GradeEntry] as number | null;
          const qGrade = computeQuarter(ww, pt, pe);
          (updated as any)[`${q}Grade`] = qGrade;
        }

        // Recompute final grade from all quarters
        const q1 = updated.q1Grade as number | null;
        const q2 = updated.q2Grade as number | null;
        const q3 = updated.q3Grade as number | null;
        const q4 = updated.q4Grade as number | null;
        const quarters = [q1, q2, q3, q4].filter((v) => v !== null) as number[];
        const final = quarters.length
          ? Math.round((quarters.reduce((a, b) => a + b, 0) / quarters.length) * 100) / 100
          : null;
        updated.finalGrade = final;
        updated.remarks = final !== null ? (final >= 75 ? "PASSED" : "FAILED") : null;
        return updated;
      })
    );

    // Persist
    try {
      const response = await fetch("/api/grades", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: grade.id, field, value: num }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update grade");
    } catch (error) {
      setGrades((current) => current.map((entry) => entry.id === grade.id ? grade : entry));
      showToast("error", error instanceof Error ? error.message : "Failed to update grade");
    } finally {
      setSaving((s) => ({ ...s, [grade.id]: false }));
    }
  };

  const gradeLabel = (v: number | null) => (v !== null ? v.toFixed(2) : "—");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Grading Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            DepEd Formula: 30% Written Works · 50% Performance Tasks · 20% Periodic Test
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <BookOpen className="h-4 w-4" /> Select Section
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FileCheck2 className="h-4 w-4" /> Generate SF9
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or subject..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">Grade Entries</p>
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 font-medium">Student</th>
                  <th className="px-3 py-3 font-medium">Subject</th>
                  <th className="px-3 py-3 font-medium text-center" colSpan={3}>Q1 (WW/PT/PT)</th>
                  <th className="px-3 py-3 font-medium text-center" colSpan={3}>Q2 (WW/PT/PT)</th>
                  <th className="px-3 py-3 font-medium text-center" colSpan={3}>Q3 (WW/PT/PT)</th>
                  <th className="px-3 py-3 font-medium text-center" colSpan={3}>Q4 (WW/PT/PT)</th>
                  <th className="px-3 py-3 font-medium text-center">Final</th>
                  <th className="px-3 py-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 15).map((g) => (
                  <tr key={g.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">{g.enrollment.student.lastName}, {g.enrollment.student.firstName}</p>
                      <p className="font-mono text-xs text-slate-400">{g.enrollment.student.lrn}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{g.subject.shortName || g.subject.name}</td>
                    {["q1", "q2", "q3", "q4"].map((q) => (
                      <td key={q} colSpan={3} className="px-1 py-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g[`${q}WrittenWork` as keyof GradeEntry] as number ?? ""}
                            disabled={!g.canEdit || Boolean(saving[g.id])}
                            onChange={(e) => updateGrade(g, `${q}WrittenWork`, e.target.value)}
                            className="w-14 rounded border border-slate-200 px-1 py-1 text-center text-xs outline-none focus:border-blue-500"
                            placeholder="WW"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g[`${q}PerformanceTask` as keyof GradeEntry] as number ?? ""}
                            disabled={!g.canEdit || Boolean(saving[g.id])}
                            onChange={(e) => updateGrade(g, `${q}PerformanceTask`, e.target.value)}
                            className="w-14 rounded border border-slate-200 px-1 py-1 text-center text-xs outline-none focus:border-blue-500"
                            placeholder="PT"
                          />
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={g[`${q}PeriodicTest` as keyof GradeEntry] as number ?? ""}
                            disabled={!g.canEdit || Boolean(saving[g.id])}
                            onChange={(e) => updateGrade(g, `${q}PeriodicTest`, e.target.value)}
                            className="w-14 rounded border border-slate-200 px-1 py-1 text-center text-xs outline-none focus:border-blue-500"
                            placeholder="PE"
                          />
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-semibold text-slate-900">{gradeLabel(g.finalGrade)}</td>
                    <td className="px-3 py-2">
                      {g.remarks ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${g.remarks === "PASSED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {g.remarks}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}