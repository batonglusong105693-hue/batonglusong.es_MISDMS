"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  permissions: string[];
}

const API_CATEGORIES = {
  STUDENTS: "Student Management",
  GRADES: "Grade Management",
  ATTENDANCE: "Attendance Tracking",
  ANALYTICS: "Analytics",
  REPORTS: "Reports",
};

const ENDPOINTS: Record<string, ApiEndpoint[]> = {
  STUDENTS: [
    {
      path: "/api/students",
      method: "GET",
      description: "List all students with pagination",
      permissions: ["student:view"],
    },
    {
      path: "/api/students",
      method: "POST",
      description: "Create a new student record",
      permissions: ["student:create"],
    },
  ],
  GRADES: [
    {
      path: "/api/grades",
      method: "GET",
      description: "List grades with filtering",
      permissions: ["grades:view"],
    },
    {
      path: "/api/grades",
      method: "POST",
      description: "Create or update grades",
      permissions: ["grades:create"],
    },
    {
      path: "/api/grades/workflow",
      method: "POST",
      description: "Manage grade workflow",
      permissions: ["grades:manage"],
    },
  ],
  ATTENDANCE: [
    {
      path: "/api/attendance",
      method: "GET",
      description: "Get attendance records",
      permissions: ["attendance:view"],
    },
    {
      path: "/api/attendance",
      method: "POST",
      description: "Record attendance",
      permissions: ["attendance:create"],
    },
  ],
  ANALYTICS: [
    {
      path: "/api/analytics",
      method: "GET",
      description: "Get analytics metrics and dashboards",
      permissions: ["analytics:view"],
    },
  ],
  REPORTS: [
    {
      path: "/api/reports/class-record",
      method: "GET",
      description: "Generate class record (SF2)",
      permissions: ["reports:view"],
    },
    {
      path: "/api/reports/master-list",
      method: "GET",
      description: "Generate master list (SF1)",
      permissions: ["reports:view"],
    },
  ],
};

const CODE_EXAMPLES: Record<string, Record<string, string>> = {
  javascript: {
    getStudents: `const response = await fetch('/api/students', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
console.log(data);`,
    createStudent: `const response = await fetch('/api/students', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lrn: '123456789',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@school.edu'
  })
});`,
  },
  python: {
    getStudents: `import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.school.edu/api/students', headers=headers)
data = response.json()
print(data)`,
  },
  curl: {
    getStudents: `curl -X GET https://api.school.edu/api/students \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"`,
  },
};

export default function ApiDocumentationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("STUDENTS");
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null);
  const [codeLanguage, setCodeLanguage] = useState("javascript");
  const [copiedCode, setCopiedCode] = useState(false);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  const endpoints = ENDPOINTS[selectedCategory] || [];

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
          <p className="mt-2 text-gray-600">
            Complete API reference and code examples for MISDMS-BLES
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow sticky top-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Categories
              </h2>
              <div className="space-y-2">
                {Object.entries(API_CATEGORIES).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedCategory(key);
                      setSelectedEndpoint(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md font-medium transition-colors ${
                      selectedCategory === key
                        ? "bg-blue-100 text-blue-900"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Quick Links */}
              <div className="mt-8 pt-8 border-t">
                <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a href="#authentication" className="text-blue-600 hover:text-blue-900">
                      Authentication
                    </a>
                  </li>
                  <li>
                    <a href="#errors" className="text-blue-600 hover:text-blue-900">
                      Error Handling
                    </a>
                  </li>
                  <li>
                    <a href="#pagination" className="text-blue-600 hover:text-blue-900">
                      Pagination
                    </a>
                  </li>
                  <li>
                    <a href="#rate-limits" className="text-blue-600 hover:text-blue-900">
                      Rate Limits
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Category Endpoints */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {API_CATEGORIES[selectedCategory as keyof typeof API_CATEGORIES]}
              </h2>

              <div className="space-y-3">
                {endpoints.map((endpoint, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedEndpoint === endpoint
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold text-white ${
                          endpoint.method === "GET"
                            ? "bg-blue-600"
                            : endpoint.method === "POST"
                            ? "bg-green-600"
                            : endpoint.method === "PATCH"
                            ? "bg-yellow-600"
                            : "bg-red-600"
                        }`}
                      >
                        {endpoint.method}
                      </span>
                      <div className="flex-1">
                        <p className="font-mono text-sm font-medium text-gray-900">
                          {endpoint.path}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {endpoint.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Endpoint Details */}
            {selectedEndpoint && (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  Endpoint Details
                </h3>

                <div className="space-y-4">
                  {/* Path and Method */}
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Endpoint</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-3 py-1 rounded text-xs font-bold text-white ${
                          selectedEndpoint.method === "GET"
                            ? "bg-blue-600"
                            : selectedEndpoint.method === "POST"
                            ? "bg-green-600"
                            : "bg-yellow-600"
                        }`}
                      >
                        {selectedEndpoint.method}
                      </span>
                      <code className="font-mono text-sm text-gray-900">
                        {selectedEndpoint.path}
                      </code>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Required Permissions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedEndpoint.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-medium"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Code Examples */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-900">
                        Code Examples
                      </p>
                      <select
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="javascript">JavaScript</option>
                        <option value="python">Python</option>
                        <option value="curl">cURL</option>
                      </select>
                    </div>

                    {CODE_EXAMPLES[codeLanguage]?.getStudents && (
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto relative">
                        <button
                          onClick={() =>
                            copyToClipboard(
                              CODE_EXAMPLES[codeLanguage].getStudents
                            )
                          }
                          className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          {copiedCode ? "Copied!" : "Copy"}
                        </button>
                        <pre>
                          <code>
                            {CODE_EXAMPLES[codeLanguage].getStudents}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Getting Started */}
            <div className="rounded-lg bg-blue-50 p-6 shadow border border-blue-200">
              <h3 id="authentication" className="text-lg font-bold text-blue-900 mb-3">
                Getting Started
              </h3>
              <div className="space-y-3 text-sm text-blue-800">
                <p>
                  <strong>1. Authentication:</strong> All API requests require a JWT token in
                  the Authorization header.
                </p>
                <p>
                  <strong>2. Base URL:</strong> https://api.school.edu (use
                  http://localhost:3000 for development)
                </p>
                <p>
                  <strong>3. Rate Limits:</strong> 1000 requests per hour per user
                </p>
                <p>
                  <strong>4. Response Format:</strong> All responses are JSON
                </p>
              </div>
            </div>

            {/* Error Codes */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 id="errors" className="text-lg font-bold text-gray-900 mb-4">
                Common Error Codes
              </h3>
              <div className="space-y-3">
                {[
                  { code: 400, msg: "Bad Request - Invalid parameters" },
                  { code: 401, msg: "Unauthorized - Missing or invalid token" },
                  { code: 403, msg: "Forbidden - Insufficient permissions" },
                  { code: 404, msg: "Not Found - Resource does not exist" },
                  { code: 429, msg: "Too Many Requests - Rate limit exceeded" },
                  { code: 500, msg: "Internal Server Error" },
                ].map((error) => (
                  <div key={error.code} className="flex gap-3 p-3 bg-gray-50 rounded">
                    <span className="font-mono font-bold text-red-600 w-12">
                      {error.code}
                    </span>
                    <span className="text-sm text-gray-700">{error.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="mt-12 rounded-lg bg-green-50 p-6 shadow border border-green-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-green-700">API Status</p>
              <p className="text-2xl font-bold text-green-600 mt-2">✓ Operational</p>
            </div>
            <div>
              <p className="text-sm text-green-700">Uptime (30d)</p>
              <p className="text-2xl font-bold text-green-600 mt-2">99.9%</p>
            </div>
            <div>
              <p className="text-sm text-green-700">Response Time</p>
              <p className="text-2xl font-bold text-green-600 mt-2">~150ms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
