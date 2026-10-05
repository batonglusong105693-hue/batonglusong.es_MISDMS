"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Users, Download, X, Eye, Loader2, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";
import { PaginationControls, PageSizeSelector, type PaginationMeta } from "@/components/PaginationControls";

interface Student {
  id: string;
  lrn: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: string;
  birthDate: string;
  address: string | null;
  status: string;
  enrollments: { section: { name: string; gradeLevel: string } | null }[];
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

interface StudentForm {
  lrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  address: string;
}

const emptyForm: StudentForm = {
  lrn: "", firstName: "", middleName: "", lastName: "",
  gender: "MALE", birthDate: "", address: "",
};

const MAX_SEARCH_RESULTS = 1000;

export default function StudentsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadStudents = async (currentPage: number, currentPageSize: number, query = "") => {
    try {
      setLoading(true);

      if (query.trim()) {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "students",
            query: query.trim(),
            page: currentPage,
            pageSize: MAX_SEARCH_RESULTS,
          }),
        });

        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setStudents(list);
        setPagination({
          currentPage: Number(data?.page ?? currentPage),
          pageSize: Number(data?.pageSize ?? MAX_SEARCH_RESULTS),
          totalItems: Number(data?.total ?? list.length),
          totalPages: Number(data?.totalPages ?? 1),
          hasNextPage: Number(data?.page ?? currentPage) < Number(data?.totalPages ?? 1),
          hasPreviousPage: Number(data?.page ?? currentPage) > 1,
        });
        return;
      }

      const res = await fetch(`/api/students?page=${currentPage}&pageSize=${currentPageSize}`);
      const data: PaginatedResponse<Student> = await res.json();
      setStudents(data.data);
      setPagination(data.pagination);
    } catch (err) {
      showToast("error", "Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents(page, pageSize, search);
  }, [page, pageSize, search]);

  const filtered = students;

  const canManage = session?.user?.role ? hasPermission(session.user.role as any, "student:manage") : false;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^\d{12}$/.test(form.lrn)) e.lrn = "LRN must be exactly 12 digits";
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim()) e.lastName = "Last name is required";
    if (!form.birthDate) e.birthDate = "Birth date is required";
    if (!form.address.trim()) e.address = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) { showToast("error", "Please fix the form errors"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/students", {
        method: editingStudentId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingStudentId ? { id: editingStudentId, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      showToast("success", editingStudentId ? "Student record updated" : "Student created successfully");
      setShowAddModal(false); setEditingStudentId(null); setForm(emptyForm);
      loadStudents(editingStudentId ? page : 1, pageSize, search);
    } catch (err: any) {
      showToast("error", err.message || "Failed to save student");
    } finally { setSaving(false); }
  };

  const exportCSV = () => {
    const header = "LRN,Last Name,First Name,Middle Name,Gender,Status\n";
    const rows = filtered.map((s) => `${s.lrn},${s.lastName},${s.firstName},${s.middleName || ""},${s.gender},${s.status}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students.csv"; a.click();
    URL.revokeObjectURL(url);
    showToast("success", "Students exported to CSV");
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";

  const startEditingStudent = (student: Student) => {
    setForm({
      lrn: student.lrn,
      firstName: student.firstName,
      middleName: student.middleName || "",
      lastName: student.lastName,
      gender: student.gender,
      birthDate: student.birthDate ? new Date(student.birthDate).toISOString().slice(0, 10) : "",
      address: student.address || "",
    });
    setErrors({});
    setEditingStudentId(student.id);
    setViewStudent(null);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Student Records</h1>
          <p className="mt-1 text-sm text-slate-500">Manage learner profiles and enrollment records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          {canManage && (
            <button onClick={() => { setEditingStudentId(null); setForm(emptyForm); setShowAddModal(true); }} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
              <Plus className="h-4 w-4" /> Add Student
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            const nextValue = e.target.value;
            setSearch(nextValue);
            setPage(1);
          }}
          placeholder="Search by name or LRN..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Users className="h-4 w-4 text-blue-600" /> Students List
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">{filtered.length} students</span>
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">LRN</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Gender</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{student.lrn}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{student.lastName}, {student.firstName} {student.middleName || ""}</td>
                    <td className="px-4 py-3 text-slate-600">{student.gender}</td>
                    <td className="px-4 py-3 text-slate-600">{student.enrollments[0]?.section?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">{student.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewStudent(student)} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {pagination && !loading && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <PageSizeSelector
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              isLoading={loading}
            />
            <div className="text-sm text-slate-600">
              Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(page * pageSize, pagination.totalItems)}
              </span>{" "}
              of <span className="font-medium">{pagination.totalItems}</span> students
            </div>
          </div>
          <PaginationControls
            pagination={pagination}
            onPageChange={setPage}
            isLoading={loading}
          />
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingStudentId ? "Edit Student Record" : "Add New Student"}</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">LRN (12 digits) *</label>
                <input type="text" value={form.lrn} onChange={(e) => setForm({ ...form, lrn: e.target.value.replace(/\D/g, "").slice(0, 12) })} placeholder="e.g. 136789012345" readOnly={Boolean(editingStudentId)} className={`${inputCls} read-only:bg-slate-100`} />
                {errors.lrn && <p className={errCls}>{errors.lrn}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">First Name *</label>
                  <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputCls} />
                  {errors.firstName && <p className={errCls}>{errors.firstName}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Middle Name</label>
                  <input type="text" value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Last Name *</label>
                  <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputCls} />
                  {errors.lastName && <p className={errCls}>{errors.lastName}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Gender *</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputCls}>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Birth Date *</label>
                <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={inputCls} />
                {errors.birthDate && <p className={errCls}>{errors.birthDate}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Address *</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House no., Street, Barangay, City" className={inputCls} />
                {errors.address && <p className={errCls}>{errors.address}</p>}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saving ? "Saving..." : editingStudentId ? "Save Changes" : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Student Modal */}
      {viewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewStudent(null)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Student Details</h2>
              <button onClick={() => setViewStudent(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 p-6">
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
                <span className="text-xs font-medium text-blue-700">LRN</span>
                <span className="font-mono text-sm font-bold text-blue-800">{viewStudent.lrn}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">Full Name</span>
                <span className="text-sm font-medium text-slate-900">{viewStudent.lastName}, {viewStudent.firstName} {viewStudent.middleName || ""}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">Gender</span>
                <span className="text-sm font-medium text-slate-900">{viewStudent.gender}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">Birth Date</span>
                <span className="text-sm font-medium text-slate-900">{viewStudent.birthDate ? new Date(viewStudent.birthDate).toLocaleDateString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">Address</span>
                <span className="text-sm font-medium text-slate-900">{viewStudent.address || "—"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-500">Section</span>
                <span className="text-sm font-medium text-slate-900">{viewStudent.enrollments[0]?.section?.name || "Not enrolled"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">{viewStudent.status}</span>
              </div>
              {canManage && (
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => startEditingStudent(viewStudent)} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
                    <Pencil className="h-4 w-4" /> Edit Student
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}