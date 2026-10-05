"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { hasPermission, type Role } from "@/lib/permissions";

interface WorkflowGrade {
  id: string;
  student: string;
  lrn: string;
  subject: string;
  status: string;
  createdBy: string;
  createdAt: string;
}

interface WorkflowHistory {
  fromStatus: string;
  toStatus: string;
  action: string;
  performedBy: string;
  remarks?: string;
  timestamp: string;
}

type GradeStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "POSTED" | "FINALIZED";

const STATUS_COLORS: Record<GradeStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  POSTED: "bg-purple-100 text-purple-800",
  FINALIZED: "bg-indigo-100 text-indigo-800",
};

const WORKFLOW_STEPS: { status: GradeStatus; label: string; description: string }[] = [
  { status: "DRAFT", label: "Draft", description: "Entry in progress" },
  { status: "SUBMITTED", label: "Submitted", description: "Awaiting review" },
  { status: "UNDER_REVIEW", label: "Review", description: "Being reviewed" },
  { status: "APPROVED", label: "Approved", description: "Ready to post" },
  { status: "POSTED", label: "Posted", description: "Posted to records" },
  { status: "FINALIZED", label: "Finalized", description: "Locked" },
];

export default function GradeWorkflowPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const canManageWorkflow = session?.user?.role
    ? hasPermission(session.user.role as Role, "grades:manage")
    : false;
  const [view, setView] = useState<"pending" | "history">("pending");
  const [selectedStatus, setSelectedStatus] = useState<GradeStatus>("SUBMITTED");
  const [grades, setGrades] = useState<WorkflowGrade[]>([]);
  const [history, setHistory] = useState<WorkflowHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<Set<string>>(new Set());
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [selectedGradeId, setSelectedGradeId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id && view === "pending") {
      fetchGradesPending();
    }
  }, [session, view, selectedStatus]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchGradesPending() {
    setLoading(true);
    setError(null);

    try {
      const sectionsResponse = await fetch("/api/sections?page=1&pageSize=1");
      const sectionsData = sectionsResponse.ok ? await sectionsResponse.json() : null;
      const sectionId = sectionsData?.data?.[0]?.id;
      if (!sectionId) {
        setGrades([]);
        return;
      }
      const response = await fetch(
        `/api/grades/workflow?sectionId=${sectionId}&status=${selectedStatus}`
      );

      if (!response.ok) throw new Error("Failed to fetch grades");

      const data = await response.json();
      setGrades(data.grades || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load grades");
    } finally {
      setLoading(false);
    }
  }

  async function fetchWorkflowHistory(gradeId: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/grades/workflow?gradeId=${gradeId}`);

      if (!response.ok) throw new Error("Failed to fetch history");

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  function toggleGradeSelection(gradeId: string) {
    const newSelected = new Set(selectedGrades);
    if (newSelected.has(gradeId)) {
      newSelected.delete(gradeId);
    } else {
      newSelected.add(gradeId);
    }
    setSelectedGrades(newSelected);
  }

  async function handleGradeAction(gradeId: string, action: string, requiresRemark: boolean = false) {
    if (!canManageWorkflow) return;
    if (requiresRemark) {
      setSelectedGradeId(gradeId);
      setPendingAction(action);
      setShowRemarkModal(true);
      return;
    }

    await executeAction(gradeId, action);
  }

  async function executeAction(gradeId: string, action: string) {
    setActionInProgress(gradeId);
    setError(null);

    try {
      const response = await fetch("/api/grades/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          gradeId,
          remarks: remarkText,
        }),
      });

      if (!response.ok) throw new Error("Action failed");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setShowRemarkModal(false);
      setRemarkText("");
      await fetchGradesPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleBulkAction(action: string) {
    if (!canManageWorkflow) return;
    if (selectedGrades.size === 0) {
      setError("Please select at least one grade");
      return;
    }

    setActionInProgress("bulk");
    setError(null);

    try {
      const response = await fetch("/api/grades/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_update",
          gradeIds: Array.from(selectedGrades),
          toStatus: "UNDER_REVIEW",
          remarks: remarkText,
        }),
      });

      if (!response.ok) throw new Error("Bulk action failed");

      const data = await response.json();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
      setSelectedGrades(new Set());
      setRemarkText("");
      await fetchGradesPending();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    } finally {
      setActionInProgress(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Grade Workflow</h1>
          <p className="mt-2 text-gray-600">
            Manage grade submission and approval workflow
          </p>
        </div>

        {/* Workflow Diagram */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Status</h2>
          <div className="flex overflow-x-auto gap-2 pb-2">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.status} className="flex items-center">
                <div
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    STATUS_COLORS[step.status]
                  }`}
                >
                  <div>{step.label}</div>
                  <div className="text-xs">{step.description}</div>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="mx-2 text-gray-400">→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-green-800">
            Action completed successfully!
          </div>
        )}

        {/* View Tabs */}
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => setView("pending")}
            className={`px-4 py-2 font-medium border-b-2 ${
              view === "pending"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setView("history")}
            className={`px-4 py-2 font-medium border-b-2 ${
              view === "history"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            History
          </button>
        </div>

        {/* Pending Grades View */}
        {view === "pending" && (
          <div className="space-y-6">
            {/* Status Filter */}
            <div className="rounded-lg bg-white p-4 shadow">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Filter by Status
              </label>
              <div className="flex flex-wrap gap-2">
                {(["SUBMITTED", "UNDER_REVIEW", "APPROVED"] as GradeStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1 rounded-md text-sm font-medium ${
                      selectedStatus === status
                        ? STATUS_COLORS[status]
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {canManageWorkflow && selectedGrades.size > 0 && (
              <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-blue-900">
                    {selectedGrades.size} grade(s) selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBulkAction("approve")}
                      disabled={actionInProgress === "bulk"}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Approve Selected
                    </button>
                    <button
                      onClick={() => setSelectedGrades(new Set())}
                      className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Grades List */}
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : grades.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <p className="text-gray-500">No grades found with this status</p>
              </div>
            ) : (
              <div className="rounded-lg bg-white shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          {canManageWorkflow && (
                          <input
                            type="checkbox"
                            checked={selectedGrades.size === grades.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGrades(new Set(grades.map((g) => g.id)));
                              } else {
                                setSelectedGrades(new Set());
                              }
                            }}
                            className="h-4 w-4"
                          />
                          )}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                          Student
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                          Subject
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">
                          Submitted By
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {grades.map((grade) => (
                        <tr key={grade.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            {canManageWorkflow && (
                            <input
                              type="checkbox"
                              checked={selectedGrades.has(grade.id)}
                              onChange={() => toggleGradeSelection(grade.id)}
                              className="h-4 w-4"
                            />
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {grade.student}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {grade.subject}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${STATUS_COLORS[grade.status as GradeStatus]}`}>
                              {grade.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {grade.createdBy}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {canManageWorkflow && grade.status === "SUBMITTED" && (
                                <>
                                  <button
                                    onClick={() => handleGradeAction(grade.id, "approve")}
                                    disabled={actionInProgress === grade.id}
                                    className="text-sm text-green-600 hover:text-green-900 font-medium disabled:text-gray-400"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleGradeAction(grade.id, "reject", true)}
                                    disabled={actionInProgress === grade.id}
                                    className="text-sm text-red-600 hover:text-red-900 font-medium disabled:text-gray-400"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {canManageWorkflow && grade.status === "APPROVED" && (
                                <button
                                  onClick={() => handleGradeAction(grade.id, "post")}
                                  disabled={actionInProgress === grade.id}
                                  className="text-sm text-purple-600 hover:text-purple-900 font-medium disabled:text-gray-400"
                                >
                                  Post
                                </button>
                              )}
                              {canManageWorkflow && grade.status === "POSTED" && (
                                <button
                                  onClick={() => handleGradeAction(grade.id, "finalize")}
                                  disabled={actionInProgress === grade.id}
                                  className="text-sm text-indigo-600 hover:text-indigo-900 font-medium disabled:text-gray-400"
                                >
                                  Finalize
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History View */}
        {view === "history" && (
          <div className="rounded-lg bg-white p-6 shadow">
            <p className="text-gray-600 text-center py-8">
              Select a grade to view its workflow history
            </p>
          </div>
        )}

        {/* Remark Modal */}
        {showRemarkModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {pendingAction === "reject" ? "Reject Grade" : "Add Remark"}
              </h2>

              <textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Enter your remark or feedback..."
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRemarkModal(false);
                    setRemarkText("");
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedGradeId && pendingAction) {
                      executeAction(selectedGradeId, pendingAction);
                    }
                  }}
                  disabled={actionInProgress === selectedGradeId}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-400"
                >
                  {actionInProgress === selectedGradeId ? "Processing..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
