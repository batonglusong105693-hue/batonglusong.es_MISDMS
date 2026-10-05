import { prisma } from "@/lib/prisma";
import { getActiveAcademicYear } from "@/lib/academic-year";
import { Users, ClipboardList, GraduationCap, FolderArchive } from "lucide-react";

const grades = ["KINDERGARTEN", "GRADE_1", "GRADE_2", "GRADE_3", "GRADE_4", "GRADE_5", "GRADE_6"];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [year, students, docs, faculty, enrolls, secs, gradeCounts] = await Promise.all([
    getActiveAcademicYear(),
    prisma.student.count({ where: { status: "ENROLLED" } }),
    prisma.document.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.user.count({ where: { role: { in: ["TEACHER", "ADVISER", "PRINCIPAL"] } } }),
    prisma.enrollment.count({ where: { status: "ENROLLED" } }),
    prisma.section.findMany({ select: { id: true, gradeLevel: true } }),
    prisma.enrollment.groupBy({ by: ["sectionId"], where: { status: "ENROLLED" }, _count: true }),
  ]);

  const total = Math.max(gradeCounts.reduce((a: number, b: { _count: number }) => a + b._count, 0), 1);
  const byGrade = grades.map((g) => {
    const ids = secs.filter((s: { gradeLevel: string }) => s.gradeLevel === g).map((s: { id: string }) => s.id);
    const count = gradeCounts
      .filter((gc: { sectionId: string | null }) => ids.includes(gc.sectionId!))
      .reduce((a: number, b: { _count: number }) => a + b._count, 0);
    return { name: g.replace("_", " "), count };
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">School Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">
        Academic Year: <span className="font-semibold text-slate-700">{year?.year ?? "No active year set"}</span>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Enrolled Students" value={students} color="bg-blue-600" />
        <Stat icon={ClipboardList} label="Total Enrollments" value={enrolls} color="bg-emerald-600" />
        <Stat icon={GraduationCap} label="Faculty & Staff" value={faculty} color="bg-amber-600" />
        <Stat icon={FolderArchive} label="Pending Documents" value={docs} color="bg-purple-600" />
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Enrollment by Grade Level</h2>
          <div className="space-y-2">
            {byGrade.map((g) => (
              <div key={g.name} className="flex items-center gap-3">
                <span className="w-28 text-sm text-slate-600">{g.name}</span>
                <div className="flex-1 rounded-full bg-slate-100">
                  <div className="rounded-full bg-blue-600 py-1 text-center text-xs text-white" style={{ width: `${Math.max((g.count / total) * 100, 4)}%` }}>
                    {g.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Quick Actions</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>• Generate SF1 School Register</li>
            <li>• Record daily attendance</li>
            <li>• Review pending document approvals</li>
            <li>• Print report cards (SF9)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color} text-white`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}