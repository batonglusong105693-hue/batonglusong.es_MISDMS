"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer, ArrowLeft } from "lucide-react";

const titles: Record<string, string> = {
  sf1: "School Register (SF1)",
  sf2: "Daily Attendance Report (SF2)",
  sf5: "Report on Promotion & Level of Proficiency (SF5)",
  sf6: "Summarized Report on Promotion (SF6)",
  sf9: "Report Card / Form 138 (SF9)",
  sf10: "Permanent Record / Form 137 (SF10)",
};

export default function PrintFormPage() {
  const params = useParams();
  const router = useRouter();
  const code = String(params.form || "sf1");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/students")
      .then((r) => r.json())
      .then((data: any[]) => setRows(data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{titles[code] || titles.sf1}</h1>
          <p className="mt-1 text-sm text-slate-500">BATONG LUSONG ELEMENTARY SCHOOL — Print Preview</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push("/reports")} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-8">
        <div className="text-center">
          <p className="text-sm font-medium">Republic of the Philippines</p>
          <p className="text-sm font-medium">Department of Education</p>
          <p className="text-sm font-medium">Region IV-A CALABARZON</p>
          <p className="text-sm font-medium">Schools Division of Batangas Province</p>
          <h2 className="mt-2 text-lg font-bold uppercase">Batong Lusong Elementary School</h2>
          <p className="mt-2 text-sm font-bold uppercase underline underline-offset-4">{titles[code] || titles.sf1}</p>
          <p className="mt-1 text-xs text-slate-500">School Year 2025-2026</p>
        </div>

        <table className="mt-6 w-full border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-2 border-slate-800 bg-slate-100 text-center">
              <th className="border border-slate-700 px-2 py-2 font-semibold">NO.</th>
              <th className="border border-slate-700 px-2 py-2 font-semibold">LRN</th>
              <th className="border border-slate-700 px-2 py-2 font-semibold">LEARNER&apos;S NAME (Last, First, Middle)</th>
              <th className="border border-slate-700 px-2 py-2 font-semibold">SEX</th>
              <th className="border border-slate-700 px-2 py-2 font-semibold">BIRTH DATE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i} className="border border-slate-400">
                <td className="border border-slate-400 px-2 py-1.5 text-center">{i + 1}</td>
                <td className="border border-slate-400 px-2 py-1.5 font-mono">{s.lrn}</td>
                <td className="border border-slate-400 px-2 py-1.5">{s.lastName}, {s.firstName} {s.middleName || ""}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{s.gender === "MALE" ? "M" : "F"}</td>
                <td className="border border-slate-400 px-2 py-1.5 text-center">{s.birthDate ? new Date(s.birthDate).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 flex justify-between text-xs">
          <div>
            <p>Prepared by:</p>
            <p className="mt-6 font-bold">_________________________</p>
            <p className="font-medium">Class Adviser</p>
          </div>
          <div>
            <p>Checked by:</p>
            <p className="mt-6 font-bold">_________________________</p>
            <p className="font-medium">School Head</p>
          </div>
        </div>
      </div>

      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
    </div>
  );
}