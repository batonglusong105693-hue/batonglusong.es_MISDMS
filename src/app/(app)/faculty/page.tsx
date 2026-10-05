"use client";

import { useEffect, useState } from "react";
import { Search, GraduationCap, X, Loader2, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";

interface Faculty {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isAdviser: boolean;
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

interface FacultyForm {
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
}

const emptyForm: FacultyForm = { name: "", email: "", password: "", role: "TEACHER", department: "" };

export default function FacultyPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [form, setForm] = useState<FacultyForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadFaculty = () => {
    fetch("/api/faculty")
      .then((res) => res.json())
      .then((data: PaginatedResponse<Faculty> | Faculty[]) => {
        setFaculty(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(() => showToast("error", "Failed to load faculty"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadFaculty(); }, []);

  const filtered = faculty.filter((f) =>
    `${f.name} ${f.email} ${f.department || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Full name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email";
    if (!editingFacultyId && form.password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { showToast("error", "Please fix the form errors"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/faculty", {
        method: editingFacultyId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingFacultyId
          ? { id: editingFacultyId, name: form.name, email: form.email, role: form.role, department: form.department }
          : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      showToast("success", editingFacultyId ? "Account updated successfully" : "Faculty member added successfully");
      setShowModal(false); setEditingFacultyId(null); setForm(emptyForm); loadFaculty();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save faculty");
    } finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";
  const canEditAccounts = session?.user?.role === "SUPER_ADMIN";

  const startEditingFaculty = (member: Faculty) => {
    setForm({ name: member.name, email: member.email, password: "", role: member.role, department: member.department || "" });
    setErrors({});
    setEditingFacultyId(member.id);
    setShowModal(true);
  };

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    PRINCIPAL: "Principal",
    TEACHER: "Teacher",
    ADMIN_OFFICER: "Administrative Officer",
    ADMIN_SUPPORT: "Administrative Support Staff",
    ADVISER: "Adviser",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty & Staff</h1>
          <p className="mt-1 text-sm text-slate-500">Manage teaching and non-teaching personnel</p>
        </div>
        {canEditAccounts && (
          <button onClick={() => { setEditingFacultyId(null); setForm(emptyForm); setShowModal(true); }} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <GraduationCap className="h-4 w-4" /> Add Faculty
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search faculty..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">Personnel List</p>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {filtered.length} personnel
          </span>
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Adviser</th>
                  {canEditAccounts && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{f.name}</td>
                    <td className="px-4 py-3 text-slate-600">{f.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {roleLabels[f.role] || f.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{f.department || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {f.isAdviser ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Adviser</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {canEditAccounts && (
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => startEditingFaculty(f)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
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
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingFacultyId ? "Edit Faculty Account" : "Add Faculty Member"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Jhon M. Dela Cruz" className={inputCls} />
                {errors.name && <p className={errCls}>{errors.name}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@bles.edu.ph" className={inputCls} />
                {errors.email && <p className={errCls}>{errors.email}</p>}
              </div>
              {!editingFacultyId && <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Temporary Password *</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className={inputCls} />
                {errors.password && <p className={errCls}>{errors.password}</p>}
              </div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
                    {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                  <input type="text" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Kindergarten Dept" className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                  {saving ? "Saving..." : editingFacultyId ? "Save Changes" : "Save Faculty"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
