"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasPermission, type Role } from "@/lib/permissions";

interface Alert {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
  isResolved: boolean;
}

interface AlertSummary {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  unresolved: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-800 border-blue-300",
  WARNING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  CRITICAL: "bg-red-100 text-red-800 border-red-300",
};

const SEVERITY_ICONS: Record<string, string> = {
  INFO: "ℹ️",
  WARNING: "⚠️",
  CRITICAL: "🚨",
};

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const canManageAlerts = session?.user?.role
    ? hasPermission(session.user.role as Role, "alerts:manage")
    : false;
  const [view, setView] = useState<"all" | "summary" | "checks">("all");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [checkInProgress, setCheckInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      if (view === "all") fetchAlerts();
      else if (view === "summary") fetchSummary();
    }
  }, [session, view]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchAlerts() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/alerts?view=unresolved&limit=50");

      if (!response.ok) throw new Error("Failed to fetch alerts");

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummary() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/alerts?view=summary");

      if (!response.ok) throw new Error("Failed to fetch summary");

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveAlert(alertId: string) {
    if (!canManageAlerts) return;
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resolve",
          alertId,
        }),
      });

      if (!response.ok) throw new Error("Failed to resolve alert");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve alert");
    }
  }

  async function handleCheck(checkType: string) {
    setCheckInProgress(checkType);
    setError(null);

    try {
      const response = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: `check_${checkType}`,
          threshold: 85,
        }),
      });

      if (!response.ok) throw new Error("Check failed");

      const data = await response.json();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);

      if (data.alerts && data.alerts.length > 0) {
        setAlerts(data.alerts);
        setView("all");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setCheckInProgress(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Alerts & Notifications</h1>
          <p className="mt-2 text-gray-600">
            System alerts, warnings, and performance notifications
          </p>
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

        {/* View Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          {(["all", "summary", "checks"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 font-medium border-b-2 capitalize ${
                view === v
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {v === "all" ? "All Alerts" : v === "summary" ? "Summary" : "Checks"}
            </button>
          ))}
        </div>

        {/* All Alerts View */}
        {view === "all" && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {(["INFO", "WARNING", "CRITICAL"] as const).map((severity) => (
                <button
                  key={severity}
                  onClick={() =>
                    setSelectedSeverity(
                      selectedSeverity === severity ? null : severity
                    )
                  }
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    selectedSeverity === severity
                      ? SEVERITY_COLORS[severity]
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>

            {/* Alerts List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <p className="text-gray-500">No alerts at this time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts
                  .filter(
                    (a) => !selectedSeverity || a.severity === selectedSeverity
                  )
                  .map((alert) => (
                    <div
                      key={alert.id}
                      className={`rounded-lg border p-4 shadow transition-all cursor-pointer ${
                        SEVERITY_COLORS[alert.severity]
                      }`}
                      onClick={() =>
                        setExpandedAlert(
                          expandedAlert === alert.id ? null : alert.id
                        )
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-xl">
                            {SEVERITY_ICONS[alert.severity]}
                          </span>
                          <div className="flex-1">
                            <h3 className="font-semibold">{alert.title}</h3>
                            <p className="text-sm mt-1">{alert.message}</p>
                            <p className="text-xs mt-2 opacity-75">
                              {new Date(alert.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!alert.isResolved && canManageAlerts && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveAlert(alert.id);
                            }}
                            className="px-3 py-1 text-sm bg-white rounded hover:bg-gray-100 font-medium"
                          >
                            Resolve
                          </button>
                        )}
                      </div>

                      {/* Expanded Details */}
                      {expandedAlert === alert.id && alert.metadata && (
                        <div className="mt-4 pt-4 border-t border-current border-opacity-30">
                          <h4 className="font-semibold mb-2 text-sm">Details:</h4>
                          <div className="space-y-1 text-sm">
                            {Object.entries(alert.metadata).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="opacity-75">{key}:</span>
                                <span className="font-medium">
                                  {String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Summary View */}
        {view === "summary" && summary && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overall Stats */}
            <div className="rounded-lg bg-white p-6 shadow lg:col-span-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-gray-600 text-sm">Total Alerts</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {summary.total}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm">Unresolved</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">
                    {summary.unresolved}
                  </p>
                </div>
              </div>
            </div>

            {/* By Severity */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="font-semibold text-gray-900 mb-4">By Severity</h3>
              <div className="space-y-3">
                {Object.entries(summary.bySeverity).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">{severity}</span>
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Type */}
            <div className="rounded-lg bg-white p-6 shadow lg:col-span-2">
              <h3 className="font-semibold text-gray-900 mb-4">By Type</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {Object.entries(summary.byType)
                  .filter(([, count]) => count > 0)
                  .map(([type, count]) => (
                    <div key={type} className="flex justify-between text-sm">
                      <span className="text-gray-700">{type.replace(/_/g, " ")}</span>
                      <span className="font-medium text-gray-900">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Checks View */}
        {view === "checks" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Attendance Check",
                description: "Scan for low attendance rates",
                type: "attendance",
              },
              {
                title: "Grade Check",
                description: "Scan for low grade alerts",
                type: "grades",
              },
              {
                title: "Enrollment Check",
                description: "Scan incomplete enrollments",
                type: "enrollment",
              },
            ].map((check) => (
              <div key={check.type} className="rounded-lg bg-white p-6 shadow">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {check.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4">{check.description}</p>
                <button
                  onClick={() => handleCheck(check.type)}
                  disabled={checkInProgress === check.type}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                >
                  {checkInProgress === check.type ? "Running..." : "Run Check"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
