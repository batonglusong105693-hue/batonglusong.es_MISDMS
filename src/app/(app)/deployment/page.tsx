"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface ChecklistItem {
  task: string;
  status: "CHECK" | "DONE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
}

interface ChecklistCategory {
  category: string;
  items: ChecklistItem[];
}

export default function PerformanceDeploymentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"performance" | "security" | "deployment">("performance");
  const [securityChecklist, setSecurityChecklist] = useState<ChecklistCategory[]>([]);
  const [deploymentChecklist, setDeploymentChecklist] = useState<ChecklistCategory[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load checklists
    setSecurityChecklist([
      {
        category: "Authentication & Authorization",
        items: [
          { task: "Enforce HTTPS", status: "CHECK", priority: "CRITICAL" },
          { task: "Implement rate limiting", status: "CHECK", priority: "HIGH" },
          { task: "Add CSRF protection", status: "CHECK", priority: "HIGH" },
          { task: "Validate JWT tokens", status: "CHECK", priority: "HIGH" },
          { task: "Rotate secrets regularly", status: "CHECK", priority: "MEDIUM" },
        ],
      },
      {
        category: "Data Protection",
        items: [
          { task: "Encrypt sensitive data at rest", status: "CHECK", priority: "CRITICAL" },
          { task: "Use parameterized queries", status: "CHECK", priority: "CRITICAL" },
          { task: "Sanitize user input", status: "CHECK", priority: "CRITICAL" },
          { task: "Implement CORS properly", status: "CHECK", priority: "HIGH" },
          { task: "Add content security policy", status: "CHECK", priority: "HIGH" },
        ],
      },
      {
        category: "Infrastructure",
        items: [
          { task: "Configure firewall rules", status: "CHECK", priority: "CRITICAL" },
          { task: "Enable logging & monitoring", status: "CHECK", priority: "HIGH" },
          { task: "Set up automated backups", status: "CHECK", priority: "CRITICAL" },
          { task: "Implement DDoS protection", status: "CHECK", priority: "HIGH" },
          { task: "Enable SSL/TLS certificates", status: "CHECK", priority: "CRITICAL" },
        ],
      },
      {
        category: "Application Security",
        items: [
          { task: "Remove debug endpoints", status: "CHECK", priority: "HIGH" },
          { task: "Validate all user inputs", status: "CHECK", priority: "CRITICAL" },
          { task: "Implement error handling", status: "CHECK", priority: "MEDIUM" },
          { task: "Add security headers", status: "CHECK", priority: "HIGH" },
          { task: "Regular dependency updates", status: "CHECK", priority: "MEDIUM" },
        ],
      },
    ]);

    setDeploymentChecklist([
      {
        category: "Pre-Deployment",
        items: [
          { task: "All tests passing", status: "CHECK", priority: "CRITICAL" },
          { task: "Code review completed", status: "CHECK", priority: "HIGH" },
          { task: "Security scan passed", status: "CHECK", priority: "CRITICAL" },
          { task: "Performance tested", status: "CHECK", priority: "HIGH" },
          { task: "Database migrations verified", status: "CHECK", priority: "CRITICAL" },
          { task: "Environment variables configured", status: "CHECK", priority: "HIGH" },
        ],
      },
      {
        category: "Deployment",
        items: [
          { task: "Database backup created", status: "CHECK", priority: "CRITICAL" },
          { task: "Health checks configured", status: "CHECK", priority: "HIGH" },
          { task: "Load balancer updated", status: "CHECK", priority: "HIGH" },
          { task: "Cache cleared", status: "CHECK", priority: "MEDIUM" },
          { task: "CDN purged", status: "CHECK", priority: "MEDIUM" },
          { task: "Monitoring enabled", status: "CHECK", priority: "HIGH" },
        ],
      },
      {
        category: "Post-Deployment",
        items: [
          { task: "Smoke tests run", status: "CHECK", priority: "HIGH" },
          { task: "Performance monitoring active", status: "CHECK", priority: "HIGH" },
          { task: "Error logging verified", status: "CHECK", priority: "HIGH" },
          { task: "User feedback collected", status: "CHECK", priority: "MEDIUM" },
          { task: "Metrics tracked", status: "CHECK", priority: "MEDIUM" },
          { task: "Rollback plan ready", status: "CHECK", priority: "CRITICAL" },
        ],
      },
    ]);
  }, []);

  if (status === "unauthenticated") {
    router.push("/login");
    return null;
  }

  function toggleTask(category: string, taskIndex: number) {
    const key = `${category}-${taskIndex}`;
    const newCompleted = new Set(completedTasks);
    if (newCompleted.has(key)) {
      newCompleted.delete(key);
    } else {
      newCompleted.add(key);
    }
    setCompletedTasks(newCompleted);
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-red-100 text-red-800 border-red-300";
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Performance & Deployment</h1>
          <p className="mt-2 text-gray-600">
            Optimization checklists and production readiness
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b">
          {(["performance", "security", "deployment"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium border-b-2 capitalize ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "performance"
                ? "Performance"
                : tab === "security"
                ? "Security"
                : "Deployment"}
            </button>
          ))}
        </div>

        {/* Performance Tab */}
        {activeTab === "performance" && (
          <div className="space-y-6">
            {/* Optimization Tips */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Backend Optimizations */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Backend Optimizations
                </h2>
                <div className="space-y-2">
                  {[
                    { task: "Add response caching", desc: "Use Cache-Control headers, Redis" },
                    { task: "Implement pagination", desc: "Limit result sets with skip/take" },
                    { task: "Compress responses", desc: "Use gzip compression" },
                    { task: "Minimize payload", desc: "Select only needed fields" },
                    { task: "Add request throttling", desc: "Rate limit endpoints" },
                    { task: "Batch operations", desc: "Support bulk requests" },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border">
                      <p className="font-medium text-gray-900">{item.task}</p>
                      <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frontend Optimizations */}
              <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Frontend Optimizations
                </h2>
                <div className="space-y-2">
                  {[
                    { task: "Code splitting", desc: "Split large bundles" },
                    { task: "Lazy loading", desc: "Load images/components on demand" },
                    { task: "Component memoization", desc: "Use React.memo for heavy components" },
                    { task: "Virtual scrolling", desc: "For large lists" },
                    { task: "Image optimization", desc: "Use WebP, optimize sizes" },
                    { task: "Bundle analysis", desc: "Use webpack analyzer" },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border">
                      <p className="font-medium text-gray-900">{item.task}</p>
                      <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Targets */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Performance Targets
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "API Endpoint", target: "< 500ms" },
                  { label: "Database Query", target: "< 100ms" },
                  { label: "File Upload", target: "< 5s" },
                  { label: "Bulk Operation", target: "< 30s" },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-gray-600">{item.label}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-2">{item.target}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {securityChecklist.map((category, catIdx) => (
              <div key={catIdx} className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {category.category}
                </h2>
                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => {
                    const taskKey = `${category.category}-${itemIdx}`;
                    const isCompleted = completedTasks.has(taskKey);

                    return (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded border hover:bg-gray-100 cursor-pointer"
                        onClick={() => toggleTask(category.category, itemIdx)}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => {}}
                          className="h-5 w-5 rounded"
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${isCompleted ? "line-through text-gray-500" : "text-gray-900"}`}>
                            {item.task}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Security Summary */}
            <div className="rounded-lg bg-green-50 p-6 shadow border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Security Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-green-700">Total Checks</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {securityChecklist.reduce((sum, cat) => sum + cat.items.length, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Completed</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {completedTasks.size}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-green-700">Progress</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {Math.round(
                      (completedTasks.size /
                        securityChecklist.reduce((sum, cat) => sum + cat.items.length, 0)) *
                        100
                    )}
                    %
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deployment Tab */}
        {activeTab === "deployment" && (
          <div className="space-y-6">
            {deploymentChecklist.map((category, catIdx) => (
              <div key={catIdx} className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  {category.category}
                </h2>
                <div className="space-y-2">
                  {category.items.map((item, itemIdx) => {
                    const taskKey = `${category.category}-${itemIdx}`;
                    const isCompleted = completedTasks.has(taskKey);

                    return (
                      <div
                        key={itemIdx}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded border hover:bg-gray-100 cursor-pointer"
                        onClick={() => toggleTask(category.category, itemIdx)}
                      >
                        <input
                          type="checkbox"
                          checked={isCompleted}
                          onChange={() => {}}
                          className="h-5 w-5 rounded"
                        />
                        <div className="flex-1">
                          <p className={`font-medium ${isCompleted ? "line-through text-gray-500" : "text-gray-900"}`}>
                            {item.task}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${getPriorityColor(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Deployment Summary */}
            <div className="rounded-lg bg-purple-50 p-6 shadow border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-4">Deployment Status</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-purple-700">Total Checks</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {deploymentChecklist.reduce((sum, cat) => sum + cat.items.length, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-purple-700">Completed</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {completedTasks.size}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-purple-700">Ready for Deploy</p>
                  <p className={`text-3xl font-bold mt-2 ${
                    completedTasks.size ===
                    deploymentChecklist.reduce((sum, cat) => sum + cat.items.length, 0)
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}>
                    {completedTasks.size ===
                    deploymentChecklist.reduce((sum, cat) => sum + cat.items.length, 0)
                      ? "YES ✓"
                      : "NO"}
                  </p>
                </div>
              </div>
            </div>

            {/* Deployment Instructions */}
            <div className="rounded-lg bg-blue-50 p-6 shadow border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Deployment Steps</h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li>1. Review and complete all pre-deployment checks</li>
                <li>2. Create database backup</li>
                <li>3. Run migrations on staging</li>
                <li>4. Execute smoke tests</li>
                <li>5. Deploy to production</li>
                <li>6. Monitor error logs and metrics</li>
                <li>7. Verify all services operational</li>
                <li>8. Document deployment details</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
