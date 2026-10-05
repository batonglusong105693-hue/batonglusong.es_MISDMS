"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type ExportResource = "students" | "faculty" | "grades" | "attendance" | "enrollment" | "sections";
type ExportFormat = "csv" | "json";

interface ExportCard {
  resource: ExportResource;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const EXPORT_OPTIONS: ExportCard[] = [
  {
    resource: "students",
    title: "Student Records",
    description: "Export all active student information",
    icon: "👥",
    color: "blue",
  },
  {
    resource: "faculty",
    title: "Faculty",
    description: "Export teacher and adviser records",
    icon: "👨‍🏫",
    color: "purple",
  },
  {
    resource: "grades",
    title: "Grades",
    description: "Export grade records and transcripts",
    icon: "📊",
    color: "green",
  },
  {
    resource: "attendance",
    title: "Attendance",
    description: "Export attendance records (last 1000)",
    icon: "📋",
    color: "yellow",
  },
  {
    resource: "enrollment",
    title: "Enrollment",
    description: "Export student enrollment data",
    icon: "📝",
    color: "red",
  },
  {
    resource: "sections",
    title: "Sections",
    description: "Export class section information",
    icon: "🏫",
    color: "indigo",
  },
];

export default function ExportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedResource, setSelectedResource] = useState<ExportResource | null>(null);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function handleExport(resource: ExportResource) {
    setLoading(true);
    setError(null);
    setSelectedResource(resource);

    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, format }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${resource}-${Date.now()}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) filename = match[1];
      }

      // Download file
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
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
      setSelectedResource(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Data Export</h1>
          <p className="mt-2 text-gray-600">
            Export school data in CSV or JSON format for analysis and reporting
          </p>
        </div>

        {/* Format selector */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            Export Format
          </label>
          <div className="flex gap-4">
            {(["csv", "json"] as const).map((fmt) => (
              <label key={fmt} className="flex items-center">
                <input
                  type="radio"
                  name="format"
                  value={fmt}
                  checked={format === fmt}
                  onChange={(e) => setFormat(e.target.value as ExportFormat)}
                  disabled={loading}
                  className="h-4 w-4 text-blue-600"
                />
                <span className="ml-2 text-sm text-gray-700 uppercase font-medium">
                  {fmt}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            CSV is recommended for spreadsheet software. JSON is better for data processing.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Export cards grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_OPTIONS.map((option) => {
            const colorClasses: { [key: string]: string } = {
              blue: "border-blue-200 hover:bg-blue-50",
              purple: "border-purple-200 hover:bg-purple-50",
              green: "border-green-200 hover:bg-green-50",
              yellow: "border-yellow-200 hover:bg-yellow-50",
              red: "border-red-200 hover:bg-red-50",
              indigo: "border-indigo-200 hover:bg-indigo-50",
            };

            const btnColorClasses: { [key: string]: string } = {
              blue: "bg-blue-600 hover:bg-blue-700",
              purple: "bg-purple-600 hover:bg-purple-700",
              green: "bg-green-600 hover:bg-green-700",
              yellow: "bg-yellow-600 hover:bg-yellow-700",
              red: "bg-red-600 hover:bg-red-700",
              indigo: "bg-indigo-600 hover:bg-indigo-700",
            };

            return (
              <div
                key={option.resource}
                className={`rounded-lg border-2 bg-white p-6 transition-colors ${
                  colorClasses[option.color]
                }`}
              >
                <div className="mb-4 text-4xl">{option.icon}</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  {option.title}
                </h3>
                <p className="mb-6 text-sm text-gray-600">{option.description}</p>
                <button
                  onClick={() => handleExport(option.resource)}
                  disabled={loading && selectedResource === option.resource}
                  className={`w-full rounded-md px-4 py-2 font-medium text-white transition-colors disabled:bg-gray-400 ${
                    btnColorClasses[option.color]
                  }`}
                >
                  {loading && selectedResource === option.resource ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Exporting...
                    </span>
                  ) : (
                    `Export ${option.title}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info section */}
        <div className="mt-12 rounded-lg bg-blue-50 p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">About Data Export</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ All exports are encrypted and only accessible by you</li>
            <li>✓ Student records exclude personal sensitive information</li>
            <li>✓ Attendance data includes the last 1000 records</li>
            <li>✓ All exports are logged for audit purposes</li>
            <li>✓ Exported data complies with DepEd standards</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
