"use client";

import { useEffect, useState } from "react";
import { Search, Filter, AlertCircle, Loader2, Eye, TrendingUp, Activity, AlertTriangle } from "lucide-react";
import { PaginationControls, type PaginationMeta } from "@/components/PaginationControls";

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  details?: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; role: string };
}

interface AuditSummary {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Record<string, number>;
  actionsByResource: Record<string, number>;
  recentActions: AuditLog[];
  failedAttempts: number;
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  READ: "bg-blue-100 text-blue-800",
  UPDATE: "bg-yellow-100 text-yellow-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-green-100 text-green-800",
  LOGOUT: "bg-gray-100 text-gray-800",
  PERMISSION_DENIED: "bg-red-100 text-red-800",
  EXPORT: "bg-purple-100 text-purple-800",
  IMPORT: "bg-purple-100 text-purple-800",
  BACKUP: "bg-indigo-100 text-indigo-800",
  RESTORE: "bg-indigo-100 text-indigo-800",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"logs" | "summary" | "failed">("logs");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Fetch summary on mount
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/audit-logs?view=summary&days=7");
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        console.error("Error fetching summary:", err);
      }
    };
    fetchSummary();
  }, []);

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        let url = `/api/audit-logs?page=${page}&pageSize=${pageSize}`;
        if (view === "summary") {
          url += "&view=summary";
        } else if (view === "failed") {
          url += "&view=failed";
        }
        if (actionFilter) {
          url += `&action=${actionFilter}`;
        }
        if (searchTerm) {
          url += `&search=${encodeURIComponent(searchTerm)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (view === "summary" || view === "failed") {
          setLogs(data.logs || data.recentActions || []);
        } else {
          setLogs(data.logs);
          setPagination(data);
        }
      } catch (err: any) {
        setError("Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    };

    if (view === "logs" || view === "failed") {
      fetchLogs();
    }
  }, [page, pageSize, view, actionFilter, searchTerm]);

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor system activity and security events</p>
        </div>
        <Activity className="h-8 w-8 text-blue-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Statistics */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Total Actions</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{summary.totalActions}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600">Failed Attempts</p>
                <p className="mt-2 text-2xl font-bold text-red-600">{summary.failedAttempts}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium text-slate-600">Active Users</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{Object.keys(summary.actionsByUser).length}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-xs font-medium text-slate-600">Resources Modified</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{Object.keys(summary.actionsByResource).length}</p>
            </div>
          </div>
        </div>
      )}

      {/* View Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => { setView("logs"); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            view === "logs"
              ? "bg-blue-600 text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          All Logs
        </button>
        <button
          onClick={() => { setView("failed"); setPage(1); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            view === "failed"
              ? "bg-red-600 text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Failed Attempts ({summary?.failedAttempts || 0})
        </button>
      </div>

      {/* Filters */}
      {view === "logs" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search logs..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Filter className="h-4 w-4" />
            <span>{pagination?.totalItems || 0} records</span>
          </div>
        </div>
      )}

      {/* Logs Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <Activity className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">No audit logs found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Timestamp</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">User</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Action</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Resource</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const actionColor = ACTION_COLORS[log.action] || "bg-gray-100 text-gray-800";
                  return (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {log.user?.name || "System"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                        {log.resource}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && view === "logs" && (
        <PaginationControls
          pagination={pagination}
          onPageChange={setPage}
          isLoading={loading}
        />
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Log Details</h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-600">Timestamp</span>
                <span className="text-sm font-medium text-slate-900">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-600">User</span>
                <span className="text-sm font-medium text-slate-900">
                  {selectedLog.user?.name || "System"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-600">Action</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ACTION_COLORS[selectedLog.action] || "bg-gray-100 text-gray-800"}`}>
                  {selectedLog.action}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-sm text-slate-600">Resource</span>
                <span className="text-sm font-medium text-slate-900">{selectedLog.resource}</span>
              </div>
              {selectedLog.details && (
                <div>
                  <span className="text-sm text-slate-600">Details</span>
                  <div className="mt-2 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-700 font-mono">{selectedLog.details}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
