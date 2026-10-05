"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  description: string;
  type: string;
  fields: string[];
  isDefault: boolean;
}

type ReportType = "class_record" | "master_list" | "attendance";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "class_record", label: "Class Record" },
  { value: "master_list", label: "Master List" },
  { value: "attendance", label: "Attendance Report" },
];

const AVAILABLE_FIELDS: Record<ReportType, { value: string; label: string }[]> = {
  class_record: [
    { value: "studentName", label: "Student Name" },
    { value: "lrn", label: "LRN" },
    { value: "q1Score", label: "Q1 Score" },
    { value: "q2Score", label: "Q2 Score" },
    { value: "q3Score", label: "Q3 Score" },
    { value: "q4Score", label: "Q4 Score" },
    { value: "finalGrade", label: "Final Grade" },
    { value: "gradeDescription", label: "Grade Description" },
  ],
  master_list: [
    { value: "studentName", label: "Student Name" },
    { value: "lrn", label: "LRN" },
    { value: "gender", label: "Gender" },
    { value: "attendance", label: "Attendance" },
    { value: "q1FinalGrade", label: "Q1 Final Grade" },
    { value: "q2FinalGrade", label: "Q2 Final Grade" },
    { value: "q3FinalGrade", label: "Q3 Final Grade" },
    { value: "q4FinalGrade", label: "Q4 Final Grade" },
    { value: "generalAverage", label: "General Average" },
    { value: "remarks", label: "Remarks" },
  ],
  attendance: [
    { value: "studentName", label: "Student Name" },
    { value: "lrn", label: "LRN" },
    { value: "presentDays", label: "Present Days" },
    { value: "absentDays", label: "Absent Days" },
    { value: "lateDays", label: "Late Days" },
    { value: "excusedDays", label: "Excused Days" },
    { value: "attendancePercentage", label: "Attendance %" },
    { value: "status", label: "Status" },
  ],
};

export default function ReportCustomizationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reportType, setReportType] = useState<ReportType>("class_record");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    if (session?.user?.id) {
      fetchTemplates();
      setSelectedFields(AVAILABLE_FIELDS[reportType].map((f) => f.value));
    }
  }, [session, reportType]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchTemplates() {
    try {
      setLoading(true);
      const response = await fetch(`/api/reports/custom?type=${reportType}`);

      if (!response.ok) throw new Error("Failed to fetch templates");

      const data = await response.json();
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  function toggleField(field: string) {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  }

  async function handleGenerateReport() {
    if (!sectionId || (reportType === "class_record" && !subjectId)) {
      setError("Select a section and subject before generating this report");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/reports/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          reportType,
          template: { fields: selectedFields },
          sectionId,
          subjectId: reportType === "class_record" ? subjectId : undefined,
          quarter: "FIRST",
          format,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate report");

      const filename = `report-${Date.now()}.${format}`;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      setError("Template name is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/reports/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_template",
          template: {
            name: templateName,
            description: templateDescription,
            type: reportType,
            fields: selectedFields,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to save template");

      setSuccess(true);
      setTemplateName("");
      setTemplateDescription("");
      setShowSaveTemplate(false);
      setTimeout(() => setSuccess(false), 3000);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!window.confirm("Are you sure? This action cannot be undone.")) return;

    try {
      const response = await fetch("/api/reports/custom", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });

      if (!response.ok) throw new Error("Failed to delete template");

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Report Customization</h1>
          <p className="mt-2 text-gray-600">
            Create custom reports with your preferred fields and format
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Report Type Selection */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Report Type
              </h2>
              <div className="space-y-2">
                {REPORT_TYPES.map((type) => (
                  <label key={type.value} className="flex items-center">
                    <input
                      type="radio"
                      name="reportType"
                      value={type.value}
                      checked={reportType === type.value}
                      onChange={(e) => setReportType(e.target.value as ReportType)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Scope</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Section ID
                  <input
                    value={sectionId}
                    onChange={(event) => setSectionId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="Enter section ID"
                  />
                </label>
                {reportType === "class_record" && (
                  <label className="text-sm text-gray-700">
                    Subject ID
                    <input
                      value={subjectId}
                      onChange={(event) => setSubjectId(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      placeholder="Enter subject ID"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Field Selection */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Select Fields
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Choose which fields to include in the report
              </p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {AVAILABLE_FIELDS[reportType].map((field) => (
                  <label key={field.value} className="flex items-center p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.value)}
                      onChange={() => toggleField(field.value)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Export Format */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Export Format
              </h2>
              <div className="space-y-2">
                {(["csv", "json"] as const).map((fmt) => (
                  <label key={fmt} className="flex items-center">
                    <input
                      type="radio"
                      name="format"
                      value={fmt}
                      checked={format === fmt}
                      onChange={(e) => setFormat(e.target.value as "csv" | "json")}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 uppercase font-medium">
                      {fmt}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleGenerateReport}
                disabled={generating || selectedFields.length === 0}
                className="flex-1 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                {generating ? "Generating..." : "Generate Report"}
              </button>
              <button
                onClick={() => setShowSaveTemplate(true)}
                disabled={selectedFields.length === 0}
                className="flex-1 rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:bg-gray-400"
              >
                Save as Template
              </button>
            </div>
          </div>

          {/* Sidebar - Saved Templates */}
          <div className="rounded-lg bg-white p-6 shadow h-fit">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Saved Templates
            </h2>

            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No templates saved yet
              </p>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    <p className="text-sm font-medium text-gray-900">
                      {template.name}
                    </p>
                    {template.description && (
                      <p className="text-xs text-gray-600 mt-1">
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {template.fields.length} fields
                    </p>
                    <div className="mt-2 flex gap-1">
                      {!template.isDefault && (
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="flex-1 text-xs text-red-600 hover:text-red-900 font-medium"
                        >
                          Delete
                        </button>
                      )}
                      {template.isDefault && (
                        <span className="text-xs text-gray-500">Default</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Save Template Modal */}
        {showSaveTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Save Template</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Class Record - Full"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveTemplate(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={loading}
                  className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-gray-400"
                >
                  {loading ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
