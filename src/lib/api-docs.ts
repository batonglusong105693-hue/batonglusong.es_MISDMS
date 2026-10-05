export interface ApiEndpoint {
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  description: string;
  authentication: "REQUIRED" | "OPTIONAL" | "NONE";
  permissions: string[];
  requestBody?: {
    type: string;
    example: Record<string, any>;
  };
  responseBody: {
    type: string;
    example: Record<string, any>;
  };
  statusCodes: Record<number, string>;
}

export const API_DOCUMENTATION: Record<string, ApiEndpoint[]> = {
  STUDENTS: [
    {
      path: "/api/students",
      method: "GET",
      description: "List all students with pagination",
      authentication: "REQUIRED",
      permissions: ["student:view"],
      responseBody: {
        type: "object",
        example: {
          data: [
            {
              id: "student-1",
              lrn: "123456789",
              firstName: "Juan",
              lastName: "Dela Cruz",
              email: "juan@school.edu",
              status: "ACTIVE",
            },
          ],
          pagination: {
            page: 1,
            pageSize: 20,
            total: 150,
            totalPages: 8,
          },
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
        403: "Forbidden",
      },
    },
    {
      path: "/api/students",
      method: "POST",
      description: "Create a new student record",
      authentication: "REQUIRED",
      permissions: ["student:create"],
      requestBody: {
        type: "object",
        example: {
          lrn: "123456789",
          firstName: "Juan",
          lastName: "Dela Cruz",
          email: "juan@school.edu",
          gender: "MALE",
          birthDate: "2012-05-15",
        },
      },
      responseBody: {
        type: "object",
        example: {
          id: "student-1",
          lrn: "123456789",
          firstName: "Juan",
          lastName: "Dela Cruz",
          status: "ACTIVE",
          createdAt: "2026-08-23T10:29:31Z",
        },
      },
      statusCodes: {
        201: "Created",
        400: "Invalid request",
        401: "Unauthorized",
        403: "Forbidden",
      },
    },
  ],
  GRADES: [
    {
      path: "/api/grades",
      method: "GET",
      description: "List grades with filtering",
      authentication: "REQUIRED",
      permissions: ["grades:view"],
      responseBody: {
        type: "object",
        example: {
          data: [
            {
              id: "grade-1",
              enrollment: { student: { lrn: "123456789", firstName: "Juan" } },
              subject: { name: "Mathematics" },
              firstQuarterScore: 85,
              firstFinalGrade: 85,
              status: "POSTED",
            },
          ],
          pagination: { page: 1, pageSize: 20, total: 300 },
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
        403: "Forbidden",
      },
    },
    {
      path: "/api/grades",
      method: "POST",
      description: "Create or update grades",
      authentication: "REQUIRED",
      permissions: ["grades:create"],
      requestBody: {
        type: "object",
        example: {
          enrollmentId: "enrollment-1",
          subjectId: "subject-1",
          firstQuarterScore: 85,
          secondQuarterScore: 88,
          thirdQuarterScore: 90,
          fourthQuarterScore: 92,
        },
      },
      responseBody: {
        type: "object",
        example: {
          id: "grade-1",
          enrollmentId: "enrollment-1",
          status: "DRAFT",
          firstFinalGrade: 85,
          createdAt: "2026-08-23T10:29:31Z",
        },
      },
      statusCodes: {
        201: "Created",
        200: "Updated",
        400: "Invalid request",
        401: "Unauthorized",
      },
    },
  ],
  ATTENDANCE: [
    {
      path: "/api/attendance",
      method: "GET",
      description: "Get attendance records",
      authentication: "REQUIRED",
      permissions: ["attendance:view"],
      responseBody: {
        type: "object",
        example: {
          data: [
            {
              id: "attendance-1",
              enrollment: { student: { lrn: "123456789" } },
              date: "2026-08-23",
              status: "PRESENT",
            },
          ],
          pagination: { page: 1, pageSize: 50 },
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
      },
    },
    {
      path: "/api/attendance",
      method: "POST",
      description: "Record attendance",
      authentication: "REQUIRED",
      permissions: ["attendance:create"],
      requestBody: {
        type: "object",
        example: {
          enrollmentId: "enrollment-1",
          date: "2026-08-23",
          status: "PRESENT",
        },
      },
      responseBody: {
        type: "object",
        example: {
          id: "attendance-1",
          status: "PRESENT",
          recordedAt: "2026-08-23T10:29:31Z",
        },
      },
      statusCodes: {
        201: "Created",
        400: "Invalid request",
        401: "Unauthorized",
      },
    },
  ],
  ANALYTICS: [
    {
      path: "/api/analytics",
      method: "GET",
      description: "Get analytics metrics and dashboards",
      authentication: "REQUIRED",
      permissions: ["analytics:view"],
      responseBody: {
        type: "object",
        example: {
          students: { label: "Active Students", value: 450, unit: "students" },
          faculty: { label: "Faculty Members", value: 45, unit: "staff" },
          averageAttendance: { label: "Average Attendance", value: 92.5, unit: "%" },
          averageGPA: { label: "Average GPA", value: 82.3, unit: "GPA" },
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
        403: "Forbidden",
      },
    },
  ],
  REPORTS: [
    {
      path: "/api/reports/class-record",
      method: "GET",
      description: "Generate class record (SF2)",
      authentication: "REQUIRED",
      permissions: ["reports:view"],
      responseBody: {
        type: "object",
        example: {
          id: "report-1",
          type: "class_record",
          sectionName: "Grade 6 - Section A",
          subject: "Mathematics",
          data: [
            { studentName: "Juan Dela Cruz", lrn: "123456789", q1: 85, finalGrade: 87 },
          ],
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
      },
    },
    {
      path: "/api/reports/master-list",
      method: "GET",
      description: "Generate master list (SF1)",
      authentication: "REQUIRED",
      permissions: ["reports:view"],
      responseBody: {
        type: "object",
        example: {
          id: "report-1",
          type: "master_list",
          sectionName: "Grade 6 - Section A",
          data: [
            {
              studentName: "Juan Dela Cruz",
              lrn: "123456789",
              q1: 85,
              generalAverage: 87,
              remarks: "PASSED",
            },
          ],
        },
      },
      statusCodes: {
        200: "Success",
        401: "Unauthorized",
      },
    },
  ],
};

export const ERROR_CODES: Record<number, { title: string; description: string; solution: string }> = {
  400: {
    title: "Bad Request",
    description: "The request was malformed or missing required fields",
    solution: "Check request body, verify all required fields are present",
  },
  401: {
    title: "Unauthorized",
    description: "Authentication failed or token is missing",
    solution: "Include valid JWT token in Authorization header",
  },
  403: {
    title: "Forbidden",
    description: "User lacks required permissions",
    solution: "Contact administrator to grant necessary permissions",
  },
  404: {
    title: "Not Found",
    description: "Resource does not exist",
    solution: "Verify the resource ID and path are correct",
  },
  429: {
    title: "Too Many Requests",
    description: "Rate limit exceeded",
    solution: "Wait before making another request",
  },
  500: {
    title: "Internal Server Error",
    description: "Server encountered an error",
    solution: "Contact support with error ID from response",
  },
};

export const CODE_EXAMPLES = {
  javascript: {
    getStudents: `
const response = await fetch('/api/students', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
console.log(data);
    `,
    createStudent: `
const response = await fetch('/api/students', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    lrn: '123456789',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    email: 'juan@school.edu',
    gender: 'MALE',
    birthDate: '2012-05-15'
  })
});
const data = await response.json();
console.log(data);
    `,
  },
  python: {
    getStudents: `
import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
}

response = requests.get('https://api.school.edu/api/students', headers=headers)
data = response.json()
print(data)
    `,
    createStudent: `
import requests

headers = {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
}

payload = {
    'lrn': '123456789',
    'firstName': 'Juan',
    'lastName': 'Dela Cruz',
    'email': 'juan@school.edu',
    'gender': 'MALE',
    'birthDate': '2012-05-15'
}

response = requests.post('https://api.school.edu/api/students', json=payload, headers=headers)
data = response.json()
print(data)
    `,
  },
  curl: {
    getStudents: `
curl -X GET https://api.school.edu/api/students \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"
    `,
    createStudent: `
curl -X POST https://api.school.edu/api/students \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lrn": "123456789",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "email": "juan@school.edu",
    "gender": "MALE",
    "birthDate": "2012-05-15"
  }'
    `,
  },
};

export function getEndpointsByCategory(category: string): ApiEndpoint[] {
  return API_DOCUMENTATION[category] || [];
}

export function getAllEndpoints(): ApiEndpoint[] {
  return Object.values(API_DOCUMENTATION).flat();
}

export function getEndpointByPath(path: string, method: string): ApiEndpoint | undefined {
  return getAllEndpoints().find((e) => e.path === path && e.method === method);
}

export function generateOpenApiSpec(): Record<string, any> {
  return {
    openapi: "3.0.0",
    info: {
      title: "MISDMS-BLES API",
      version: "1.0.0",
      description: "School Management System API",
    },
    servers: [
      { url: "https://api.school.edu", description: "Production" },
      { url: "http://localhost:3000", description: "Development" },
    ],
    paths: Object.fromEntries(
      getAllEndpoints().map((ep) => [
        ep.path,
        {
          [ep.method.toLowerCase()]: {
            summary: ep.description,
            security: ep.authentication === "REQUIRED" ? [{ bearerAuth: [] }] : [],
            responses: Object.fromEntries(
              Object.entries(ep.statusCodes).map(([code, desc]) => [
                code,
                { description: desc },
              ])
            ),
          },
        },
      ])
    ),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };
}
