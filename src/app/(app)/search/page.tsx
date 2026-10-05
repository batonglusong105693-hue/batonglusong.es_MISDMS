"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SearchResult {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FilterOption {
  field: string;
  label: string;
  values: string[];
}

type ResourceType = "students" | "faculty" | "grades" | "attendance" | "enrollments" | "documents";

const RESOURCES: { value: ResourceType; label: string }[] = [
  { value: "students", label: "Students" },
  { value: "faculty", label: "Faculty" },
  { value: "grades", label: "Grades" },
  { value: "attendance", label: "Attendance" },
  { value: "enrollments", label: "Enrollments" },
  { value: "documents", label: "Documents" },
];

const RESULT_COLUMNS: Record<ResourceType, string[]> = {
  students: ["LRN", "First Name", "Last Name", "Gender", "Status"],
  faculty: ["Name", "Email", "Role", "Department", "Status"],
  grades: ["Student", "Subject", "Quarter", "Grade"],
  attendance: ["Student", "Date", "Status"],
  enrollments: ["Student", "Section", "Grade Level"],
  documents: ["File Name", "Category", "Size", "Uploaded By"],
};

export default function SearchPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [resource, setResource] = useState<ResourceType>("students");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.id) {
      fetchFilterOptions();
    }
  }, [resource, session]);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  async function fetchFilterOptions() {
    try {
      const response = await fetch(`/api/search?resource=${resource}`);
      if (!response.ok) throw new Error("Failed to fetch filter options");

      const data = await response.json();
      setFilterOptions(data.filters || {});
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    await performSearch(1);
  }

  async function performSearch(pageNum: number) {
    setLoading(true);
    setError(null);

    try {
      const filterArray = Object.entries(filters)
        .filter(([, value]) => value)
        .map(([field, value]) => ({
          field,
          operator: "eq",
          value,
        }));

      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource,
          query,
          filters: filterArray,
          page: pageNum,
          pageSize: 20,
        }),
      });

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setResults(data);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function renderCell(row: any, column: string, resource: ResourceType) {
    switch (resource) {
      case "students":
        switch (column) {
          case "LRN":
            return row.lrn;
          case "First Name":
            return row.firstName;
          case "Last Name":
            return row.lastName;
          case "Gender":
            return row.gender;
          case "Status":
            return row.status;
        }
        break;
      case "faculty":
        switch (column) {
          case "Name":
            return row.name;
          case "Email":
            return row.email;
          case "Role":
            return row.role;
          case "Department":
            return row.department || "—";
          case "Status":
            return row.status;
        }
        break;
      case "grades":
        switch (column) {
          case "Student":
            return `${row.enrollment.student.firstName} ${row.enrollment.student.lastName}`;
          case "Subject":
            return row.subject.name;
          case "Quarter":
            return row.quarter;
          case "Grade":
            return row.firstFinalGrade || row.secondFinalGrade || "—";
        }
        break;
      case "attendance":
        switch (column) {
          case "Student":
            return `${row.enrollment.student.firstName} ${row.enrollment.student.lastName}`;
          case "Date":
            return new Date(row.date).toLocaleDateString();
          case "Status":
            return row.status;
        }
        break;
      case "enrollments":
        switch (column) {
          case "Student":
            return `${row.student.firstName} ${row.student.lastName}`;
          case "Section":
            return row.section.name;
          case "Grade Level":
            return row.section.gradeLevel;
        }
        break;
      case "documents":
        switch (column) {
          case "File Name":
            return row.fileName;
          case "Category":
            return row.category;
          case "Size":
            return (row.fileSize / 1024).toFixed(2) + " KB";
          case "Uploaded By":
            return row.uploadedBy.name;
        }
        break;
    }
    return "—";
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Advanced Search</h1>
          <p className="mt-2 text-gray-600">
            Search and filter across all school data
          </p>
        </div>

        {/* Search Form */}
        <div className="rounded-lg bg-white p-6 shadow mb-8">
          <form onSubmit={handleSearch} className="space-y-6">
            {/* Resource selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search In
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {RESOURCES.map((res) => (
                  <button
                    key={res.value}
                    type="button"
                    onClick={() => {
                      setResource(res.value);
                      setResults(null);
                    }}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      resource === res.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {res.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search query */}
            <div>
              <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <input
                id="query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${resource}...`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            {Object.keys(filterOptions).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Filters
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.entries(filterOptions).map(([field, values]) => (
                    <div key={field}>
                      <label htmlFor={field} className="block text-xs text-gray-600 mb-1">
                        {field.charAt(0).toUpperCase() + field.slice(1)}
                      </label>
                      <select
                        id={field}
                        value={filters[field] || ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            [field]: e.target.value,
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      >
                        <option value="">All</option>
                        {values.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search button */}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilters({});
                  setResults(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md font-medium disabled:bg-gray-400"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Results info */}
            <div className="rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold text-gray-900">{results.total}</span>{" "}
                results
              </p>
            </div>

            {/* Results table */}
            {results.data.length > 0 ? (
              <div className="rounded-lg bg-white shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {RESULT_COLUMNS[resource].map((col) => (
                          <th
                            key={col}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.data.map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          {RESULT_COLUMNS[resource].map((col) => (
                            <td
                              key={col}
                              className="px-6 py-4 text-sm text-gray-700"
                            >
                              {renderCell(row, col, resource)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <p className="text-gray-500">No results found</p>
              </div>
            )}

            {/* Pagination */}
            {results.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => performSearch(Math.max(1, page - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, results.totalPages) }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => performSearch(pageNum)}
                        className={`px-3 py-2 text-sm rounded-md ${
                          page === pageNum
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    performSearch(Math.min(results.totalPages, page + 1))
                  }
                  disabled={page === results.totalPages || loading}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
