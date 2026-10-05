"use client";

import { useEffect, useState } from "react";
import { Search, ClipboardList, Filter, X, Loader2, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";

interface Enrollment {
  id: string;
  studentId: string;
  sectionId: string | null;
  student: { lrn: string; firstName: string; lastName: string };
  section: { name: string; gradeLevel: string } | null;
  academicYear: { year: string } | null;
  status: string;
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

interface StudentOption { id: string; lrn: string; firstName: string; lastName: string; }
interface SectionOption { id: string; name: string; gradeLevel: string; academicYear?: { year: string } | null; }

export default function EnrollmentPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [form, setForm] = useState({ studentId: "", sectionId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const canManage = session?.user?.role ? hasPermission(session.user.role, "enrollment:manage") : false;

  const loadEnrollments = () => {
    fetch("/api/enrollment")
      .then((res) => res.json())
      .then((data: PaginatedResponse<Enrollment> | Enrollment[]) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setEnrollments(list);
      })
      .catch(() => showToast("error", "Failed to load enrollments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEnrollments(); }, []);

  const openModal = (enrollment?: Enrollment) => {
    setEditingEnrollment(enrollment || null);
    setForm({ studentId: enrollment?.studentId || "", sectionId: enrollment?.sectionId || "" });
    setShowModal(true); setErrors({});
    fetch("/api/students?page=1&pageSize=100")
      .then((r) => r.json())
      .then((d: PaginatedResponse<StudentOption> | StudentOption[]) => {
        setStudents(Array.isArray(d) ? d : (d?.data ?? []));
      })
      .catch(() => showToast("error", "Failed to load students"));

    fetch("/api/sections")
      .then((r) => r.json())
      .then((d: PaginatedResponse<SectionOption> | SectionOption[]) => {
        setSections(Array.isArray(d) ? d : (d?.data ?? []));
      })
      .catch(() => showToast("error", "Failed to load sections"));
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.studentId) e.studentId = "Select a student";
    if (!form.sectionId) e.sectionId = "Select a section";
    setErrors(e);
    if (Object.keys(e).length) { showToast("error", "Please fix the form errors"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/enrollment", {
        method: editingEnrollment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEnrollment ? { id: editingEnrollment.id, sectionId: form.sectionId } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enroll");
      showToast("success", editingEnrollment ? "Enrollment section updated" : "Student enrolled successfully");
      setShowModal(false); setEditingEnrollment(null); setForm({ studentId: "", sectionId: "" }); loadEnrollments();
    } catch (err: any) {
      showToast("error", err.message || "Failed to enroll student");
    } finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";

  const filtered = enrollments.filter((e) => {
    const matchesSearch = `${e.student.lrn} ${e.student.firstName} ${e.student.lastName}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesGrade = gradeFilter === "ALL" || e.section?.gradeLevel === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  const statusColors: Record<string, string> = {
    ENROLLED: "bg-green-100 text-green-700",
    PENDING: "bg-amber-100 text-amber-700",
    DROPPED: "bg-red-100 text-red-700",
    COMPLETED: "bg-blue-100 text-blue-700",
  };

  const gradeLabels: Record<string, string> = {
    KINDERGARTEN: "Kindergarten",
    GRADE_1: "Grade 1",
    GRADE_2: "Grade 2",
    GRADE_3: "Grade 3",
    GRADE_4: "Grade 4",
    GRADE_5: "Grade 5",
    GRADE_6: "Grade 6",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enrollment</h1>
          <p className="mt-1 text-sm text-slate-500">Manage student enrollment across grade levels</p>
        </div>
        {canManage && (
          <button onClick={() => openModal()} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <ClipboardList className="h-4 w-4" /> Enroll Student
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by LRN or name..."
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Grade Levels</option>
            <option value="KINDERGARTEN">Kindergarten</option>
            <option value="GRADE_1">Grade 1</option>
            <option value="GRADE_2">Grade 2</option>
            <option value="GRADE_3">Grade 3</option>
            <option value="GRADE_4">Grade 4</option>
            <option value="GRADE_5">Grade 5</option>
            <option value="GRADE_6">Grade 6</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Enrollment Records <span className="ml-2 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{filtered.length}</span>
          </p>
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">LRN</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">Academic Year</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canManage && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 30).map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.student.lrn}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {e.student.lastName}, {e.student.firstName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.section?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{gradeLabels[e.section?.gradeLevel || ""] || e.section?.gradeLevel || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.academicYear?.year || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[e.status] || "bg-slate-100 text-slate-600"}`}>
                        {e.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {e.status === "ENROLLED" && (
                          <button type="button" onClick={() => openModal(e)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900">
                            <Pencil className="h-4 w-4" /> Reassign
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingEnrollment ? "Reassign Enrollment" : "Enroll Student"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Student *</label>
                <select disabled={Boolean(editingEnrollment)} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className={inputCls}>
                  <option value="">Select student...</option>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName} ({s.lrn})</option>)}
                </select>
                {errors.studentId && <p className={errCls}>{errors.studentId}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Section *</label>
                <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} className={inputCls}>
                  <option value="">Select section...</option>
                  {sections.filter((section) => !editingEnrollment || section.academicYear?.year === editingEnrollment.academicYear?.year).map((s) => <option key={s.id} value={s.id}>{gradeLabels[s.gradeLevel] || s.gradeLevel} - {s.name}</option>)}
                </select>
                {errors.sectionId && <p className={errCls}>{errors.sectionId}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingEnrollment ? <Pencil className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                  {saving ? "Saving..." : editingEnrollment ? "Save Changes" : "Enroll Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}