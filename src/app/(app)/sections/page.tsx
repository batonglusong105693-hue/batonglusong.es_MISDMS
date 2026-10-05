"use client";

import { useEffect, useState } from "react";
import { Search, BookOpen, Users, X, Loader2, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";

interface Section {
  id: string;
  name: string;
  gradeLevel: string;
  adviserId?: string | null;
  adviser: { name: string } | null;
  academicYear: { year: string; isCurrent: boolean } | null;
  _count: { enrollments: number };
}

interface AdviserOption {
  id: string;
  name: string;
  role: string;
  department?: string | null;
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

const gradeOptions = ["KINDERGARTEN", "GRADE_1", "GRADE_2", "GRADE_3", "GRADE_4", "GRADE_5", "GRADE_6"];

const gradeLabels: Record<string, string> = {
  KINDERGARTEN: "Kindergarten", GRADE_1: "Grade 1", GRADE_2: "Grade 2", GRADE_3: "Grade 3",
  GRADE_4: "Grade 4", GRADE_5: "Grade 5", GRADE_6: "Grade 6",
};

export default function SectionsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [advisers, setAdvisers] = useState<AdviserOption[]>([]);
  const [form, setForm] = useState({ name: "", gradeLevel: "KINDERGARTEN", adviserId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const canManage = session?.user?.role ? hasPermission(session.user.role, "section:manage") : false;

  const loadSections = () => {
    fetch("/api/sections")
      .then((res) => res.json())
      .then((data: PaginatedResponse<Section> | Section[]) => {
        setSections(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(() => showToast("error", "Failed to load sections"))
      .finally(() => setLoading(false));
  };

  const loadAdvisers = async () => {
    try {
      const res = await fetch("/api/faculty?pageSize=200");
      const data = await res.json();
      const faculty = Array.isArray(data) ? data : (data?.data ?? []);
      const eligible = faculty.filter((user: AdviserOption) => ["TEACHER", "ADVISER"].includes(user.role));
      setAdvisers(eligible.sort((a: AdviserOption, b: AdviserOption) => a.name.localeCompare(b.name)));
    } catch (err) {
      setAdvisers([]);
    }
  };

  useEffect(() => { loadSections(); loadAdvisers(); }, []);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.name.trim()) { setErrors({ name: "Section name is required" }); showToast("error", "Please fix the form errors"); return; }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/sections", {
        method: editingSectionId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSectionId ? { id: editingSectionId, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      showToast("success", editingSectionId ? `Section ${form.name} updated` : `Section ${form.name} created successfully`);
      setShowModal(false); setEditingSectionId(null); setForm({ name: "", gradeLevel: "KINDERGARTEN", adviserId: "" }); loadSections();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save section");
    } finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";

  const startEditingSection = (section: Section) => {
    setForm({ name: section.name, gradeLevel: section.gradeLevel, adviserId: section.adviserId || "" });
    setErrors({});
    setEditingSectionId(section.id);
    setShowModal(true);
  };

  const filtered = sections.filter(
    (s) =>
      `${s.name} ${s.gradeLevel} ${s.adviser?.name || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sections</h1>
          <p className="mt-1 text-sm text-slate-500">Manage class sections and adviser assignments</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingSectionId(null); setForm({ name: "", gradeLevel: "KINDERGARTEN", adviserId: "" }); setShowModal(true); }} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <BookOpen className="h-4 w-4" /> Add Section
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sections..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-lg bg-slate-100" />
          ))
        ) : (
          filtered.map((section) => (
            <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {section.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-slate-500">{gradeLabels[section.gradeLevel] || section.gradeLevel}</p>
                </div>
                <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {section.academicYear?.year || "No AY"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Users className="h-4 w-4 text-slate-400" />
                  {section._count.enrollments} students
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Adviser: <span className="font-medium text-slate-800">{section.adviser?.name || "Unassigned"}</span>
              </div>
              {canManage && (
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => startEditingSection(section)} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-900">
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingSectionId ? "Edit Section" : "Add New Section"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Section Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })} placeholder="e.g. MAPAGMALASAKIT" className={inputCls} />
                {errors.name && <p className={errCls}>{errors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Grade Level *</label>
                <select value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} className={inputCls}>
                  {gradeOptions.map((g) => <option key={g} value={g}>{gradeLabels[g]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Adviser</label>
                <select value={form.adviserId} onChange={(e) => setForm({ ...form, adviserId: e.target.value })} className={inputCls}>
                  <option value="">Unassigned</option>
                  {advisers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} {teacher.role !== "ADVISER" ? "(Teacher)" : "(Adviser)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                  {saving ? "Saving..." : editingSectionId ? "Save Changes" : "Save Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
