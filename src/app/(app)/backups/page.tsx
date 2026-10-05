"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasPermission, type Role } from "@/lib/permissions";

interface Backup {
  id: string;
  timestamp: string;
  size: string;
  tables: number;
  totalRecords: number;
  status: string;
}

interface BackupDetails {
  id: string;
  timestamp: string;
  appVersion: string;
  tables: string[];
  tableDetails: { name: string; records: number }[];
  totalRecords: number;
}

export default function BackupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role as Role | undefined;
  const canCreateBackup = role ? hasPermission(role, "backup:create") : false;
  const canRestoreBackup = role ? hasPermission(role, "backup:restore") : false;
  const canDownloadBackup = role ? hasPermission(role, "backup:download") : false;
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchBackups();
    }
  }, [session]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchBackups() {
    try {
      setLoading(true);
      const response = await fetch("/api/backups");

      if (!response.ok) throw new Error("Failed to fetch backups");

      const data = await response.json();
      setBackups(data.backups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateBackup() {
    if (!canCreateBackup) return;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });

      if (!response.ok) throw new Error("Failed to create backup");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestoreBackup(backupId: string) {
    if (!canRestoreBackup) return;
    setRestoring(true);
    setError(null);

    try {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backupId }),
      });

      if (!response.ok) throw new Error("Failed to restore backup");

      setSuccess(true);
      setRestoreConfirm(null);
      setTimeout(() => setSuccess(false), 3000);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  }

  async function handleDeleteBackup(backupId: string) {
    if (!canCreateBackup) return;
    if (!window.confirm("Are you sure? This action cannot be undone.")) return;

    setError(null);

    try {
      const response = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", backupId }),
      });

      if (!response.ok) throw new Error("Failed to delete backup");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup");
    }
  }

  async function handleDownloadBackup(backupId: string) {
    if (!canDownloadBackup) return;
    try {
      const response = await fetch("/api/backups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId }),
      });

      if (!response.ok) throw new Error("Failed to download backup");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${backupId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download backup");
    }
  }

  async function handleViewDetails(backup: Backup) {
    try {
      const response = await fetch(`/api/backups?id=${backup.id}`);
      if (!response.ok) throw new Error("Failed to fetch details");

      const data = await response.json();
      setSelectedBackup(data);
      setShowDetails(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load details");
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading backups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Backups</h1>
            <p className="mt-2 text-gray-600">Create and manage system backups</p>
          </div>
          {canCreateBackup && <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {creating ? "Creating..." : "Create Backup"}
          </button>}
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
            Operation completed successfully!
          </div>
        )}

        {/* Backups list */}
        <div className="rounded-lg bg-white shadow overflow-hidden">
          {backups.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No backups yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Tables
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Records
                    </th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(backup.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{backup.size}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{backup.tables}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{backup.totalRecords}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(backup)}
                            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-900 font-medium"
                          >
                            View
                          </button>
                          {canDownloadBackup && (
                            <button onClick={() => handleDownloadBackup(backup.id)} className="px-3 py-1 text-sm text-green-600 hover:text-green-900 font-medium">
                              Download
                            </button>
                          )}
                          {canRestoreBackup && (
                            <button onClick={() => setRestoreConfirm(backup.id)} disabled={restoring} className="px-3 py-1 text-sm text-orange-600 hover:text-orange-900 font-medium disabled:text-gray-400">
                              Restore
                            </button>
                          )}
                          {canCreateBackup && (
                            <button onClick={() => handleDeleteBackup(backup.id)} className="px-3 py-1 text-sm text-red-600 hover:text-red-900 font-medium">
                              Delete
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

        {/* Details Modal */}
        {showDetails && selectedBackup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Backup Details</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Backup ID</p>
                    <p className="font-mono text-sm">{selectedBackup.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-sm">
                      {new Date(selectedBackup.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Version</p>
                    <p className="text-sm">{selectedBackup.appVersion}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Records</p>
                    <p className="text-sm">{selectedBackup.totalRecords}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Table Details</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedBackup.tableDetails.map((table) => (
                      <div
                        key={table.name}
                        className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                      >
                        <span className="text-gray-700">{table.name}</span>
                        <span className="text-gray-600">{table.records} records</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowDetails(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        {restoreConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Restore Backup?</h2>
              <p className="text-gray-600 mb-4">
                This will replace all current data with the backup. Current data will be lost.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setRestoreConfirm(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestoreBackup(restoreConfirm)}
                  disabled={restoring}
                  className="px-4 py-2 text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:bg-gray-400"
                >
                  {restoring ? "Restoring..." : "Restore"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="mt-8 rounded-lg bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">About Backups</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Backups include all system data (students, faculty, grades, attendance)</li>
            <li>✓ Backups are stored locally on the server</li>
            <li>✓ Restore will replace ALL current data - use with caution</li>
            <li>✓ Download backups for offline storage and recovery</li>
            <li>✓ All backup operations are logged in the audit trail</li>
            <li>✓ Schedule automated daily backups in system settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
