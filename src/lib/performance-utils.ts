import { prisma } from "./prisma";

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  status: "SUCCESS" | "ERROR";
  metadata?: Record<string, any>;
}

export interface DatabaseQueryMetric {
  query: string;
  duration: number;
  rowsAffected: number;
  timestamp: Date;
}

export interface ApiEndpointMetric {
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
  timestamp: Date;
  userId?: string;
}

export interface PerformanceThresholds {
  apiEndpoint: number; // ms
  databaseQuery: number; // ms
  fileUpload: number; // ms
  bulkOperation: number; // ms
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  apiEndpoint: 500,
  databaseQuery: 100,
  fileUpload: 5000,
  bulkOperation: 30000,
};

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private startTimes: Map<string, number> = new Map();

  start(operationId: string): void {
    this.startTimes.set(operationId, Date.now());
  }

  end(
    operationId: string,
    name: string,
    status: "SUCCESS" | "ERROR" = "SUCCESS",
    metadata?: Record<string, any>
  ): PerformanceMetric {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation ${operationId}`);
      return {
        name,
        duration: 0,
        timestamp: new Date(),
        status,
        metadata,
      };
    }

    const duration = Date.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      status,
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);
    this.startTimes.delete(operationId);

    return metric;
  }

  getMetrics(name: string, limit: number = 100): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    return metrics.slice(-limit);
  }

  getSummary(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    errors: number;
  } {
    const metrics = this.metrics.get(name) || [];

    if (metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, errors: 0 };
    }

    const durations = metrics.map((m) => m.duration);
    const errors = metrics.filter((m) => m.status === "ERROR").length;

    return {
      count: metrics.length,
      average: Math.round(
        durations.reduce((a, b) => a + b, 0) / durations.length
      ),
      min: Math.min(...durations),
      max: Math.max(...durations),
      errors,
    };
  }

  clear(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }
}

export async function optimizeStudentQueries(): Promise<void> {
  // Add indexes for common queries
  // In production: Run these migrations
  const indexes = [
    { model: "Student", field: "status" },
    { model: "Student", field: "lrn" },
    { model: "Enrollment", field: "status" },
    { model: "Enrollment", field: "sectionId" },
    { model: "Grade", field: "enrollmentId" },
    { model: "AttendanceRecord", field: "enrollmentId" },
    { model: "AttendanceRecord", field: "date" },
  ];

  console.log("Database indexes to create:", indexes);
}

export async function enableQueryCaching(
  ttl: number = 300
): Promise<Map<string, any>> {
  const cache = new Map<string, any>();

  // Cache common queries
  const cachedQueries = {
    activeStudents: {
      key: "active_students",
      fn: () =>
        prisma.student.findMany({
          where: { status: "ENROLLED" },
          select: { id: true, firstName: true, lastName: true, lrn: true },
        }),
      ttl,
    },
    activeFaculty: {
      key: "active_faculty",
      fn: () =>
        prisma.user.findMany({
          where: { status: "ACTIVE", role: { in: ["TEACHER", "ADVISER"] } },
          select: { id: true, name: true, email: true, role: true },
        }),
      ttl,
    },
    sections: {
      key: "sections",
      fn: () =>
        prisma.section.findMany({
          select: { id: true, name: true, gradeLevel: true },
        }),
      ttl,
    },
  };

  for (const [name, { key, fn, ttl: itemTtl }] of Object.entries(cachedQueries)) {
    try {
      const data = await fn();
      cache.set(key, { data, expiresAt: Date.now() + itemTtl * 1000 });
    } catch (err) {
      console.error(`Cache error for ${name}:`, err);
    }
  }

  return cache;
}

export function getCacheStatus(cache: Map<string, any>): Record<string, any> {
  const status: Record<string, any> = {
    size: cache.size,
    items: [],
  };

  for (const [key, value] of cache.entries()) {
    const isExpired = value.expiresAt && value.expiresAt < Date.now();
    status.items.push({
      key,
      size: JSON.stringify(value).length,
      expired: isExpired,
      expiresAt: new Date(value.expiresAt),
    });
  }

  return status;
}

export async function analyzeSlowQueries(threshold: number = 100): Promise<string[]> {
  // In production: Query database logs
  const slowQueries: string[] = [];

  // Example slow query patterns to watch for
  const patterns = [
    "SELECT * FROM", // Avoid wildcards
    "N+1 patterns", // Watch for query loops
    "Missing indexes", // Monitor index usage
    "Full table scans", // Prefer index scans
  ];

  return slowQueries;
}

export function optimizeApiEndpoints(): Record<string, string> {
  const optimizations: Record<string, string> = {
    "Add response caching": "Use Cache-Control headers, Redis",
    "Implement pagination": "Limit result sets with skip/take",
    "Compress responses": "Use gzip compression",
    "Minimize payload": "Select only needed fields",
    "Add request throttling": "Rate limit endpoints",
    "Batch operations": "Support bulk requests",
  };

  return optimizations;
}

export function optimizeClientSide(): Record<string, string> {
  const optimizations: Record<string, string> = {
    "Code splitting": "Split large bundles",
    "Lazy loading": "Load images/components on demand",
    "Component memoization": "Use React.memo for heavy components",
    "Virtual scrolling": "For large lists",
    "Image optimization": "Use WebP, optimize sizes",
    "Bundle analysis": "Use webpack analyzer",
  };

  return optimizations;
}

export async function getPerformanceReport(): Promise<{
  timestamp: Date;
  summary: Record<string, any>;
  recommendations: string[];
  thresholds: PerformanceThresholds;
}> {
  const monitor = new PerformanceMonitor();

  const report = {
    timestamp: new Date(),
    summary: {
      apiEndpoints: monitor.getSummary("api_endpoint"),
      databaseQueries: monitor.getSummary("database_query"),
      fileUploads: monitor.getSummary("file_upload"),
    },
    recommendations: [
      "Implement query result caching",
      "Add database indexes for frequently queried fields",
      "Enable gzip compression for API responses",
      "Implement pagination for large datasets",
      "Use CDN for static assets",
      "Enable browser caching",
    ],
    thresholds: DEFAULT_THRESHOLDS,
  };

  return report;
}

export function getSecurityHardeningChecklist(): {
  category: string;
  items: { task: string; status: string; priority: string }[];
}[] {
  return [
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
  ];
}

export function getDeploymentChecklist(): {
  category: string;
  items: string[];
}[] {
  return [
    {
      category: "Pre-Deployment",
      items: [
        "✓ All tests passing",
        "✓ Code review completed",
        "✓ Security scan passed",
        "✓ Performance tested",
        "✓ Database migrations verified",
        "✓ Environment variables configured",
      ],
    },
    {
      category: "Deployment",
      items: [
        "✓ Database backup created",
        "✓ Health checks configured",
        "✓ Load balancer updated",
        "✓ Cache cleared",
        "✓ CDN purged",
        "✓ Monitoring enabled",
      ],
    },
    {
      category: "Post-Deployment",
      items: [
        "✓ Smoke tests run",
        "✓ Performance monitoring active",
        "✓ Error logging verified",
        "✓ User feedback collected",
        "✓ Metrics tracked",
        "✓ Rollback plan ready",
      ],
    },
  ];
}
