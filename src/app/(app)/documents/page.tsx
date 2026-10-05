"use client";

import { useEffect, useState } from "react";
import { Search, FolderArchive, Upload, FileText, Filter, X, Loader2, Download, Check, Archive, Send, Pencil } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { PaginationControls, PageSizeSelector } from "@/components/PaginationControls";

interface Document {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  referenceNumber: string | null;
  sender: string | null;
  recipient: string | null;
  isConfidential: boolean;
  uploadedBy: { name: string } | null;
  createdAt: string;
  fileUrl: string | null;
  fileName: string | null;
  metadata: Record<string, unknown> | null;
}

interface DocForm {
  title: string;
  description: string;
  category: string;
  referenceNumber: string;
  sender: string;
  recipient: string;
  isConfidential: boolean;
  customCategory: string;
}

const emptyDocForm: DocForm = {
  title: "", description: "", category: "ADMINISTRATIVE_ISSUANCE", referenceNumber: "", sender: "", recipient: "", isConfidential: false, customCategory: "",
};

export default function DocumentsPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [view, setView] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [reloadToken, setReloadToken] = useState(0);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [form, setForm] = useState<DocForm>(emptyDocForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), view });
    if (search.trim()) params.set("search", search.trim());
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);

    const loadDocuments = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/documents?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load documents");
        if (active) {
          setDocuments(data.data || []);
          setPagination(data.pagination || {
            currentPage: page,
            pageSize,
            totalItems: data.data?.length || 0,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          });
        }
      } catch (error: any) {
        if (active && error.name !== "AbortError") {
          showToast("error", error.message || "Failed to load documents");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadDocuments();
    return () => {
      active = false;
      controller.abort();
    };
  }, [search, categoryFilter, view, page, pageSize, reloadToken, showToast]);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.category) e.category = "Category is required";
    if (form.category === "CUSTOM" && !form.customCategory.trim()) e.customCategory = "Custom category name is required";
    setErrors(e);
    if (Object.keys(e).length) { showToast("error", "Please fix the form errors"); return; }
    setSaving(true);
    try {
      let uploadedFile: { filePath: string; fileName: string; fileSize: number; mimeType: string } | null = null;

      if (selectedFile && !editingDocument) {
        const signResponse = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
          }),
        });
        const signData = await signResponse.json();
        if (!signResponse.ok) throw new Error(signData.error || "Failed to prepare file upload");

        const supabase = getSupabaseBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "dms-files")
          .uploadToSignedUrl(signData.path, signData.token, selectedFile);
        if (uploadError) throw new Error(uploadError.message || "Failed to upload file");

        const completeResponse = await fetch("/api/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            category: signData.category,
            path: signData.path,
          }),
        });
        const completeData = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(completeData.error || "Failed to save file metadata");
        uploadedFile = {
          filePath: completeData.filePath,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type,
        };
      }

      const metadata = { ...(editingDocument?.metadata || {}) };
      if (form.category === "CUSTOM") metadata.customCategory = form.customCategory.trim();
      else delete metadata.customCategory;
      const res = await fetch("/api/documents", {
        method: editingDocument ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingDocument ? { id: editingDocument.id } : {}),
          title: form.title,
          description: form.description,
          category: form.category === "CUSTOM" ? "MISCELLANEOUS" : form.category,
          referenceNumber: form.referenceNumber,
          sender: form.sender,
          recipient: form.recipient,
          isConfidential: form.isConfidential,
          metadata: Object.keys(metadata).length ? metadata : null,
          fileUrl: uploadedFile?.filePath,
          fileName: uploadedFile?.fileName,
          fileSize: uploadedFile?.fileSize,
          fileType: uploadedFile?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload");
      showToast("success", editingDocument ? "Document details updated" : "Document uploaded successfully");
      setShowModal(false); setEditingDocument(null); setForm(emptyDocForm); setSelectedFile(null); setPage(1); setReloadToken((token) => token + 1);
    } catch (err: any) {
      showToast("error", err.message || "Failed to upload document");
    } finally { setSaving(false); }
  };

  const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
  const errCls = "mt-1 text-xs text-red-600";

  const categoryLabel = (document: Document) => {
    const customCategory = document.metadata?.customCategory;
    if (document.category === "MISCELLANEOUS" && typeof customCategory === "string" && customCategory) {
      return customCategory;
    }
    return categoryLabels[document.category] || document.category;
  };

  const openPreview = (document: Document) => {
    if (!document.fileUrl) return;
    const hasQuery = document.fileUrl.includes("?");
    setPreviewUrl(`${document.fileUrl}${hasQuery ? "&" : "?"}preview=1`);
    setPreviewTitle(document.title);
  };

  const changeStatus = async (document: Document, status: string) => {
    const reason = status === "REJECTED" ? window.prompt("Reason for rejecting this document:")?.trim() : undefined;
    if (status === "REJECTED" && !reason) return;

    try {
      const response = await fetch("/api/documents/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: document.id, status, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update document status");
      showToast("success", `Document ${status.toLowerCase().replace("_", " ")}`);
      setReloadToken((token) => token + 1);
    } catch (err: any) {
      showToast("error", err.message || "Failed to update document status");
    }
  };

  const categoryLabels: Record<string, string> = {
    ADMINISTRATIVE_ISSUANCE: "Administrative Issuance",
    DEPED_ORDER: "DepEd Order",
    DEPED_MEMORANDUM: "DepEd Memorandum",
    STUDENT_RECORD: "Student Record",
    FINANCIAL_MOOE: "Financial / MOOE",
    PROCUREMENT: "Procurement",
    INVENTORY: "Inventory",
    LESSON_PLAN: "Lesson Plan",
    SCHOOL_FORM: "School Form",
    CORRESPONDENCE: "Correspondence",
    MISCELLANEOUS: "Miscellaneous",
  };

  const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-600",
    PENDING_REVIEW: "bg-amber-100 text-amber-700",
    APPROVED: "bg-green-100 text-green-700",
    ARCHIVED: "bg-blue-100 text-blue-700",
    RELEASED: "bg-purple-100 text-purple-700",
    REJECTED: "bg-red-100 text-red-700",
  };

  const role = session?.user?.role;
  const canManage = role ? hasPermission(role, "document:manage") : false;
  const canApprove = role ? hasPermission(role, "document:approve") : false;
  const canRelease = role ? hasPermission(role, "document:release") : false;

  const startEditingDocument = (document: Document) => {
    const customCategory = document.metadata?.customCategory;
    setForm({
      title: document.title,
      description: document.description || "",
      category: document.category === "MISCELLANEOUS" && typeof customCategory === "string" ? "CUSTOM" : document.category,
      referenceNumber: document.referenceNumber || "",
      sender: document.sender || "",
      recipient: document.recipient || "",
      isConfidential: document.isConfidential,
      customCategory: typeof customCategory === "string" ? customCategory : "",
    });
    setErrors({});
    setSelectedFile(null);
    setEditingDocument(document);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Archive</h1>
          <p className="mt-1 text-sm text-slate-500">Manage administrative and school documents</p>
        </div>
        {canManage && (
          <button onClick={() => { setEditingDocument(null); setForm(emptyDocForm); setSelectedFile(null); setShowModal(true); }} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800">
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search documents..."
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <FolderArchive className="h-4 w-4 text-blue-600" />
            Document List
          </div>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {pagination.totalItems} documents
          </span>
        </div>
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-fit rounded-md border border-slate-300 p-1" aria-label="Document view">
            <button type="button" onClick={() => { setView("active"); setPage(1); }} aria-pressed={view === "active"} className={`rounded px-3 py-1.5 text-sm font-medium ${view === "active" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Active
            </button>
            <button type="button" onClick={() => { setView("archived"); setPage(1); }} aria-pressed={view === "archived"} className={`rounded px-3 py-1.5 text-sm font-medium ${view === "archived" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              Archived
            </button>
          </div>
          <PageSizeSelector pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} isLoading={loading} />
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {view === "archived" ? "No archived documents" : "No documents found"}
            </p>
            <p className="mt-1 text-sm text-slate-500">Try changing the search or category filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Ref #</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Uploaded By</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">{d.title}</p>
                          {d.isConfidential && (
                            <span className="mt-0.5 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">CONFIDENTIAL</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {categoryLabel(d)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.referenceNumber || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[d.status] || "bg-slate-100 text-slate-600"}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{d.uploadedBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {d.fileUrl ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openPreview(d)}
                            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900"
                            title={`Preview ${d.fileName || "document"}`}
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-xs font-medium">Preview</span>
                          </button>
                          <a href={d.fileUrl} className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900" title={`Download ${d.fileName || "document"}`}>
                            <Download className="h-4 w-4" />
                            <span className="text-xs font-medium">Download</span>
                          </a>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canManage && (
                          <button type="button" onClick={() => startEditingDocument(d)} className="text-blue-700 hover:text-blue-900" title="Edit document details">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {d.status === "PENDING_REVIEW" && canApprove && (
                          <>
                            <button type="button" onClick={() => changeStatus(d, "APPROVED")} className="text-green-700 hover:text-green-900" title="Approve">
                              <Check className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => changeStatus(d, "REJECTED")} className="text-red-600 hover:text-red-800" title="Reject">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {d.status === "APPROVED" && canRelease && (
                          <button type="button" onClick={() => changeStatus(d, "RELEASED")} className="text-blue-700 hover:text-blue-900" title="Release">
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        {(d.status === "APPROVED" || d.status === "RELEASED" || d.status === "REJECTED") && canManage ? (
                          <button type="button" onClick={() => changeStatus(d, "ARCHIVED")} className="text-slate-600 hover:text-slate-900" title="Archive">
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : null}
                        {(d.status === "DRAFT" || d.status === "REJECTED") && canManage && (
                          <button type="button" onClick={() => changeStatus(d, "PENDING_REVIEW")} className="text-blue-700 hover:text-blue-900" title="Submit for review">
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {pagination.totalPages > 1 && (
        <PaginationControls pagination={pagination} onPageChange={setPage} isLoading={loading} />
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewUrl(null)}>
          <div className="w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-lg font-bold text-slate-900">{previewTitle}</h3>
              <button type="button" onClick={() => setPreviewUrl(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-slate-50 p-3">
              <iframe src={previewUrl} title={previewTitle} className="h-[70vh] w-full rounded-md border border-slate-200 bg-white" />
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">{editingDocument ? "Edit Document Details" : "Upload Document"}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. DepEd Order No. 12, s. 2025" className={inputCls} />
                {errors.title && <p className={errCls}>{errors.title}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description of the document" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Category *</label>
                  <select disabled={Boolean(editingDocument)} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                    {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    <option value="CUSTOM">Custom category (Miscellaneous)</option>
                  </select>
                  {errors.category && <p className={errCls}>{errors.category}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reference Number</label>
                  <input type="text" value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="e.g. DO-12-s2025" className={inputCls} />
                </div>
              </div>
              {form.category === "CUSTOM" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Custom Category Name *</label>
                  <input type="text" maxLength={80} value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} className={inputCls} placeholder="e.g. School Improvement Plan" />
                  {errors.customCategory && <p className={errCls}>{errors.customCategory}</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Sender</label>
                  <input type="text" value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} placeholder="e.g. DepEd Central Office" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Recipient</label>
                  <input type="text" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} placeholder="e.g. School Head" className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.isConfidential} onChange={(e) => setForm({ ...form, isConfidential: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
                Mark as Confidential (e.g. 201 Files, PDS)
              </label>
              {!editingDocument && <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Document File</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  accept=".pdf,.doc,.docx,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp"
                />
                <p className="mt-1 text-xs text-slate-500">Files are stored privately in Supabase Storage.</p>
              </div>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {saving ? "Saving..." : editingDocument ? "Save Changes" : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
