import { prisma } from "./prisma";

export interface SearchFilter {
  field: string;
  operator: "eq" | "contains" | "gt" | "gte" | "lt" | "lte" | "in" | "between";
  value: any;
}

export interface SearchOptions {
  query?: string;
  filters?: SearchFilter[];
  sort?: { field: string; order: "asc" | "desc" };
  skip?: number;
  take?: number;
}

export interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SEARCHABLE_FIELDS: Record<string, string[]> = {
  students: ["firstName", "lastName", "lrn", "email"],
  faculty: ["name", "email", "department"],
  grades: ["subjectName"],
  sections: ["name", "gradeLevel"],
  documents: ["fileName", "category"],
};

const FILTERABLE_FIELDS: Record<string, Record<string, string>> = {
  students: {
    status: "string",
    gender: "string",
    gradeLevel: "string",
    createdAt: "date",
  },
  faculty: {
    role: "string",
    department: "string",
    status: "string",
  },
  grades: {
    quarter: "string",
    status: "string",
  },
  sections: {
    gradeLevel: "string",
    academicYearId: "string",
  },
  documents: {
    category: "string",
    status: "string",
  },
};

export async function searchStudents(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { query = "", filters = [], sort = { field: "lastName", order: "asc" }, skip = 0, take = 20 } = options;

  const where: any = {};

  // Text search
  if (query) {
    where.OR = [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { lrn: { contains: query } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  // Apply filters
  for (const filter of filters) {
    applyFilter(where, filter);
  }

  const [data, total] = await Promise.all([
    prisma.student.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      select: {
        id: true,
        lrn: true,
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        address: true,
        email: true,
        status: true,
        createdAt: true,
        enrollments: {
          where: { status: "ENROLLED" },
          select: {
            section: {
              select: { name: true, gradeLevel: true },
            },
          },
          take: 1,
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  return {
    data,
    total,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

export async function searchFaculty(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { query = "", filters = [], sort = { field: "name", order: "asc" }, skip = 0, take = 20 } = options;

  const where: any = {
    role: { in: ["TEACHER", "ADVISER", "ADMIN_OFFICER", "ADMIN_SUPPORT"] },
  };

  // Text search
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { department: { contains: query, mode: "insensitive" } },
    ];
  }

  // Apply filters
  for (const filter of filters) {
    applyFilter(where, filter);
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        status: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    total,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

export async function searchGrades(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { query = "", filters = [], sort = { field: "createdAt", order: "desc" }, skip = 0, take = 20 } = options;

  const where: any = {};

  // Apply filters
  for (const filter of filters) {
    applyFilter(where, filter);
  }

  const [data, total] = await Promise.all([
    prisma.grade.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      include: {
        enrollment: {
          select: {
            student: { select: { firstName: true, lastName: true, lrn: true } },
          },
        },
        subject: { select: { name: true } },
      },
    }),
    prisma.grade.count({ where }),
  ]);

  // Filter by query if provided
  const filtered =
    query && query.length > 0
      ? data.filter(
          (g) =>
            g.subject.name.toLowerCase().includes(query.toLowerCase()) ||
            `${g.enrollment.student.firstName} ${g.enrollment.student.lastName}`
              .toLowerCase()
              .includes(query.toLowerCase())
        )
      : data;

  return {
    data: filtered,
    total: filtered.length,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(filtered.length / take),
  };
}

export async function searchAttendance(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { filters = [], sort = { field: "date", order: "desc" }, skip = 0, take = 20 } = options;

  const where: any = {};

  // Apply filters
  for (const filter of filters) {
    if (filter.field === "studentId") {
      where.enrollment = { studentId: filter.value };
    } else if (filter.field === "status") {
      where.status = filter.value;
    } else if (filter.field === "date") {
      if (filter.operator === "between" && Array.isArray(filter.value) && filter.value.length === 2) {
        where.date = {
          gte: new Date(filter.value[0]),
          lte: new Date(filter.value[1]),
        };
      }
    }
  }

  const [data, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      include: {
        enrollment: {
          select: {
            student: { select: { firstName: true, lastName: true, lrn: true } },
          },
        },
      },
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return {
    data,
    total,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

export async function searchEnrollments(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { query = "", filters = [], sort = { field: "createdAt", order: "desc" }, skip = 0, take = 20 } = options;

  const where: any = {};

  // Text search
  if (query) {
    where.OR = [
      {
        student: {
          OR: [
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { lrn: { contains: query } },
          ],
        },
      },
      { section: { name: { contains: query, mode: "insensitive" } } },
    ];
  }

  // Apply filters
  for (const filter of filters) {
    applyFilter(where, filter);
  }

  const [data, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      include: {
        student: { select: { firstName: true, lastName: true, lrn: true } },
        section: { select: { name: true, gradeLevel: true } },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return {
    data,
    total,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

export async function searchDocuments(
  options: SearchOptions
): Promise<SearchResult<any>> {
  const { query = "", filters = [], sort = { field: "createdAt", order: "desc" }, skip = 0, take = 20 } = options;

  const where: any = {};

  // Text search
  if (query) {
    where.OR = [
      { fileName: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
    ];
  }

  // Apply filters
  for (const filter of filters) {
    applyFilter(where, filter);
  }

  const [data, total] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: { [sort.field]: sort.order },
      select: {
        id: true,
        fileName: true,
        category: true,
        fileSize: true,
        uploadedBy: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.document.count({ where }),
  ]);

  return {
    data,
    total,
    page: Math.floor(skip / take) + 1,
    pageSize: take,
    totalPages: Math.ceil(total / take),
  };
}

export async function getFilterOptions(
  resource: string
): Promise<Record<string, any[]>> {
  const options: Record<string, any[]> = {};

  const fields = FILTERABLE_FIELDS[resource] || {};

  for (const [field, type] of Object.entries(fields)) {
    if (resource === "students") {
      if (field === "status") {
        options.status = ["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED"];
      } else if (field === "gender") {
        options.gender = ["MALE", "FEMALE"];
      } else if (field === "gradeLevel") {
        const levels = await prisma.section.findMany({
          distinct: ["gradeLevel"],
          select: { gradeLevel: true },
        });
        options.gradeLevel = levels.map((l) => l.gradeLevel);
      }
    } else if (resource === "faculty") {
      if (field === "role") {
        options.role = ["TEACHER", "ADVISER", "ADMIN_OFFICER", "ADMIN_SUPPORT"];
      } else if (field === "status") {
        options.status = ["ACTIVE", "INACTIVE", "ON_LEAVE"];
      } else if (field === "department") {
        const depts = await prisma.user.findMany({
          distinct: ["department"],
          select: { department: true },
          where: { department: { not: null } },
        });
        options.department = depts.map((d) => d.department).filter(Boolean);
      }
    } else if (resource === "grades") {
      if (field === "quarter") {
        options.quarter = ["FIRST", "SECOND", "THIRD", "FOURTH"];
      } else if (field === "status") {
        options.status = ["DRAFT", "POSTED", "FINALIZED"];
      }
    } else if (resource === "documents") {
      if (field === "category") {
        options.category = [
          "SYLLABUS",
          "ASSIGNMENT",
          "EXAM",
          "CERTIFICATE",
          "REPORT",
          "OTHER",
        ];
      }
    }
  }

  return options;
}

function applyFilter(where: any, filter: SearchFilter): void {
  const { field, operator, value } = filter;

  if (!where[field]) {
    where[field] = {};
  }

  switch (operator) {
    case "contains":
      where[field] = { contains: value, mode: "insensitive" };
      break;
    case "eq":
      where[field] = value;
      break;
    case "gt":
      where[field] = { gt: value };
      break;
    case "gte":
      where[field] = { gte: value };
      break;
    case "lt":
      where[field] = { lt: value };
      break;
    case "lte":
      where[field] = { lte: value };
      break;
    case "in":
      where[field] = { in: Array.isArray(value) ? value : [value] };
      break;
    case "between":
      if (Array.isArray(value) && value.length === 2) {
        where[field] = { gte: value[0], lte: value[1] };
      }
      break;
  }
}

export function getSearchableFields(resource: string): string[] {
  return SEARCHABLE_FIELDS[resource] || [];
}

export function getFilterableFields(
  resource: string
): Record<string, string> {
  return FILTERABLE_FIELDS[resource] || {};
}
