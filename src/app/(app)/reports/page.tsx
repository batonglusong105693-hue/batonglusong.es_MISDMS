"use client";

import { useRouter } from "next/navigation";
import { FileText, Printer, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";

const forms = [
  { code: "SF1", title: "School Register", grade: "All Levels" },
  { code: "SF2", title: "Daily Attendance Report", grade: "All Levels" },
  { code: "SF5", title: "Report on Promotion & Level of Proficiency", grade: "Grades 1-6" },
  { code: "SF6", title: "Summarized Report on Promotion", grade: "All Levels" },
  { code: "SF9", title: "Report Card / Form 138", grade: "All Levels" },
  { code: "SF10", title: "Permanent Record / Form 137", grade: "All Levels" },
];

export default function ReportsPage() {
  const router = useRouter();
  const [enrollmentCount, setEnrollmentCount] = useState(0);

  useEffect(() => {
    fetch("/api/enrollment")
      .then((r) => r.json())
      .then((d) => setEnrollmentCount(Array.isArray(d) ? d.length : 0))
      .catch(() => {});
  }, []);

  const exportCsv = () => {
    fetch("/api/enrollment")
      .then((r) => r.json())
      .then((data) => {
        const rows = [
          ["LRN", "Last Name", "First Name", "Section", "Grade Level", "Academic Year", "Status"],
          ...data.map((e: any) => [
            e.student.lrn, e.student.lastName, e.student.firstName, e.section?.name || "", e.section?.gradeLevel || "", e.academicYear?.year || "", e.status,
          ]),
        ];
        const csv = rows.map((r) => r.map((c: unknown) => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "SF1-School-Register-BLES-" + new Date().toISOString().split("T")[0] + ".csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const generate = (code: string) => {
    router.push(`/reports/print/${code.toLowerCase()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports & School Forms</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate DepEd official forms (SF1 - SF10) for Batong Lusong Elementary School
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <FileSpreadsheet className="h-4 w-4" /> Export SF1 Register CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {forms.map((form) => (
          <div key={form.code} className="rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-lg font-bold text-blue-700">
                {form.code}
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{form.grade}</span>
            </div>
            <h3 className="mt-4 font-bold text-slate-900">{form.title}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {form.code === "SF1" ? enrollmentCount + " learners in current academic year" : "Printable DepEd A4 format"}
            </p>
            <button onClick={() => generate(form.code)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-white hover:bg-blue-800">
              <Printer className="h-3.5 w-3.5" /> Generate & Print
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
        <p className="font-medium">⚠️ School Forms Notice</p>
        <p className="mt-1">
          SF1 and SF2 must be maintained by the class adviser and checked by the School Head every quarter.
          SF9 (Report Card) requires parental signature upon release.
        </p>
      </div>
    </div>
  );
}