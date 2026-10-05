"use client";

import { useEffect, useState } from "react";
import { Search, FileCheck2, ArrowRightLeft } from "lucide-react";

interface ReleaseLog {
  id: string;
  document: { title: string; referenceNumber: string | null } | null;
  receiverName: string;
  receiverType: string | null;
  purpose: string | null;
  status: string;
  dateReleased: string;
  dateReturned: string | null;
}

export default function ReleasedLogsPage() {
  const [logs, setLogs] = useState<ReleaseLog[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents/released")
      .then((res) => res.json())
      .then((data) => setLogs(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter((l) =>
    `${l.document?.title || ""} ${l.receiverName} ${l.purpose || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Released Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Track physical and digital document releases</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search releases..."
          className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:max-w-sm"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">Document Release Records</p>
        </div>
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Receiver</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Released</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{l.document?.title || "—"}</p>
                      <p className="font-mono text-xs text-slate-400">{l.document?.referenceNumber || ""}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.receiverName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {l.receiverType || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.purpose || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(l.dateReleased).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${l.status === "OUT" ? "bg-amber-100 text-amber-700" : l.status === "RETURNED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        <ArrowRightLeft className="h-3 w-3" />
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}