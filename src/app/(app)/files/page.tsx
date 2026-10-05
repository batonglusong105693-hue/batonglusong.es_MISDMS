"use client";

import { useEffect, useState } from "react";
import { Upload, Trash2, Download, AlertCircle, Loader2, File, Filter, Search } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

interface UploadedFile {
  id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileSizeFormatted: string;
  mimeType: string;
  category: string;
  uploadedAt: string;
  uploadedBy: string;
  isPublic: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  document: "📄",
  image: "🖼️",
  audio: "🎵",
  video: "🎬",
  archive: "📦",
  spreadsheet: "📊",
  presentation: "📽️",
};

export default function FileUploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalFiles, setTotalFiles] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/upload?page=${page}&pageSize=${pageSize}`);
      const data = await res.json();
      setFiles(data.files);
      setTotalFiles(data.pagination.total);
    } catch (err) {
      setError("Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [page, pageSize]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const signResponse = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      const signData = await signResponse.json();
      if (!signResponse.ok) {
        const data = signData;
        throw new Error(data.error || "Upload failed");
      }

      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "dms-files")
        .uploadToSignedUrl(signData.path, signData.token, file);

      if (uploadError) throw new Error(uploadError.message || "Upload failed");

      const completeResponse = await fetch("/api/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          category: signData.category,
          path: signData.path,
        }),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeData.error || "Failed to save upload");

      setSuccess(`${file.name} uploaded successfully`);
      setTimeout(() => setSuccess(""), 3000);
      loadFiles();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (fileId: string, fileName: string) => {
    if (!confirm(`Delete ${fileName}?`)) return;

    try {
      const res = await fetch(`/api/upload?id=${fileId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Delete failed");

      setSuccess("File deleted successfully");
      setTimeout(() => setSuccess(""), 3000);
      loadFiles();
    } catch (err: any) {
      setError(err.message || "Delete failed");
    }
  };

  const filteredFiles = files.filter((f) => {
    if (categoryFilter && f.category !== categoryFilter) return false;
    if (searchTerm && !f.originalName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const categories = Array.from(new Set(files.map((f) => f.category)));
  const totalPages = Math.ceil(totalFiles / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">File Management</h1>
          <p className="mt-1 text-sm text-slate-500">Upload and manage school documents and media</p>
        </div>
        <Upload className="h-8 w-8 text-blue-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          <Upload className="h-5 w-5 shrink-0" />
          {success}
        </div>
      )}

      {/* Upload Section */}
      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center">
        <Upload className="mx-auto h-12 w-12 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-900">Drag and drop files or click to browse</p>
        <p className="mt-1 text-xs text-slate-600">
          Supported: Documents, Images, Audio, Video, Archives, Spreadsheets, Presentations
        </p>
        <label className="mt-4 inline-block">
          <button
            disabled={uploading}
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Choose File"
            )}
          </button>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            accept="*/*"
          />
        </label>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_ICONS[cat] || "📎"} {cat}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Filter className="h-4 w-4" />
          <span>{filteredFiles.length} files</span>
        </div>
      </div>

      {/* Files Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <File className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">No files found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">File Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Size</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Uploaded By</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Date</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900 max-w-xs truncate">
                      {CATEGORY_ICONS[file.category] || "📎"} {file.originalName}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        {file.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{file.fileSizeFormatted}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{file.uploadedBy}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(file.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        <a
                          href={file.filePath}
                          download
                          className="text-blue-600 hover:text-blue-800"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => handleDelete(file.id, file.originalName)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
