import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import {
  searchStudents,
  searchFaculty,
  searchGrades,
  searchAttendance,
  searchEnrollments,
  searchDocuments,
  getFilterOptions,
  type SearchOptions,
} from "@/lib/search-utils";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";
import { prisma } from "@/lib/prisma";

const searchableResources = [
  "students",
  "faculty",
  "grades",
  "attendance",
  "enrollments",
  "documents",
] as const;

type SearchableResource = (typeof searchableResources)[number];

const sortFields: Record<SearchableResource, string[]> = {
  students: ["lastName", "firstName", "lrn", "createdAt", "status", "gender"],
  faculty: ["name", "email", "department", "role", "status"],
  grades: ["createdAt", "updatedAt", "finalGrade", "workflowStatus"],
  attendance: ["date", "status", "createdAt"],
  enrollments: ["createdAt", "dateEnrolled", "status"],
  documents: ["createdAt", "title", "category", "status", "fileName"],
};

type FilterType = "enum" | "string" | "number" | "date" | "id";
type SearchOperator = NonNullable<SearchOptions["filters"]>[number]["operator"];
type FilterField = {
  type: FilterType;
  operators: readonly SearchOperator[];
  values?: readonly string[];
};

const filterFields: Record<SearchableResource, Record<string, FilterField>> = {
  students: {
    status: { type: "enum", operators: ["eq", "in"], values: ["ENROLLED", "TRANSFERRED_OUT", "DROPPED_OUT", "GRADUATED", "ALUMNI"] },
    gender: { type: "enum", operators: ["eq", "in"], values: ["MALE", "FEMALE"] },
    createdAt: { type: "date", operators: ["eq", "gt", "gte", "lt", "lte", "between"] },
  },
  faculty: {
    role: { type: "enum", operators: ["eq", "in"], values: ["SUPER_ADMIN", "PRINCIPAL", "ADMIN_OFFICER", "ADMIN_SUPPORT", "TEACHER", "ADVISER"] },
    department: { type: "string", operators: ["eq", "contains"] },
    status: { type: "enum", operators: ["eq", "in"], values: ["ACTIVE", "INACTIVE", "SUSPENDED"] },
  },
  grades: {
    workflowStatus: { type: "enum", operators: ["eq", "in"], values: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "POSTED", "FINALIZED"] },
    finalGrade: { type: "number", operators: ["eq", "gt", "gte", "lt", "lte", "between"] },
  },
  attendance: {
    status: { type: "enum", operators: ["eq", "in"], values: ["PRESENT", "ABSENT", "LATE", "EXCUSED"] },
    date: { type: "date", operators: ["eq", "gt", "gte", "lt", "lte", "between"] },
    studentId: { type: "id", operators: ["eq"] },
  },
  enrollments: {
    status: { type: "enum", operators: ["eq", "in"], values: ["PENDING", "ENROLLED", "TRANSFERRED", "DROPPED", "COMPLETED"] },
    sectionId: { type: "id", operators: ["eq"] },
    academicYearId: { type: "id", operators: ["eq"] },
  },
  documents: {
    category: { type: "enum", operators: ["eq", "in"], values: ["ADMINISTRATIVE_ISSUANCE", "DEPED_ORDER", "DEPED_MEMORANDUM", "STUDENT_RECORD", "FINANCIAL_MOOE", "PROCUREMENT", "INVENTORY", "LESSON_PLAN", "SCHOOL_FORM", "CORRESPONDENCE", "MISCELLANEOUS"] },
    status: { type: "enum", operators: ["eq", "in"], values: ["DRAFT", "PENDING_REVIEW", "APPROVED", "ARCHIVED", "RELEASED", "REJECTED"] },
    createdAt: { type: "date", operators: ["eq", "gt", "gte", "lt", "lte", "between"] },
  },
};

function isValidFilterValue(value: unknown, field: FilterField): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 &&
      value.length <= 100 &&
      value.every((item) => !Array.isArray(item) && isValidFilterValue(item, field));
  }
  if (field.type === "number") return typeof value === "number" && Number.isFinite(value);
  if (field.type === "date") return typeof value === "string" && !Number.isNaN(Date.parse(value));
  if (field.type === "id") return typeof value === "string" && value.length > 0 && value.length <= 100;
  if (field.type === "enum") return typeof value === "string" && Boolean(field.values?.includes(value));
  return typeof value === "string" && value.length <= 200;
}

async function getSearchScope(
  resource: SearchableResource,
  role: Role,
  userId: string
): Promise<SearchOptions["accessScope"] | false> {
  const isTeacher = role === "TEACHER" || role === "ADVISER";
  const permissionByResource: Record<SearchableResource, string> = {
    students: "student:view",
    faculty: "faculty:view",
    grades: "grade:view",
    attendance: "attendance:view",
    enrollments: "enrollment:view",
    documents: "document:view",
  };

  if (isTeacher && ["students", "grades", "attendance", "enrollments"].includes(resource)) {
    const [sections, teachingLoads] = await Promise.all([
      prisma.section.findMany({
        where: {
          OR: [
            { adviserId: userId },
            { teachingLoads: { some: { teacherId: userId } } },
          ],
        },
        select: { id: true },
      }),
      role === "TEACHER"
        ? prisma.teachingLoad.findMany({
            where: { teacherId: userId },
            select: { sectionId: true, subjectId: true },
          })
        : Promise.resolve([]),
    ]);

    const scope: NonNullable<SearchOptions["accessScope"]> = {
      sectionIds: sections.map((section) => section.id),
    };
    if (resource === "grades" && role === "TEACHER") {
      scope.teachingLoads = teachingLoads;
    }
    return scope;
  }

  if (hasPermission(role, permissionByResource[resource])) {
    return resource === "documents" && !["SUPER_ADMIN", "PRINCIPAL", "ADMIN_OFFICER"].includes(role)
      ? { excludeConfidentialDocuments: true }
      : undefined;
  }

  return false;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "search:data")) {
    return forbiddenResponse("Insufficient permissions to search", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/search",
    });
  }

  try {
    const body = await request.json();
    const {
      resource,
      query = "",
      filters = [],
      sort,
      page = 1,
      pageSize = 20,
    } = body;

    if (typeof resource !== "string" || !searchableResources.includes(resource as SearchableResource)) {
      return badRequestResponse("Invalid resource type");
    }
    const typedResource = resource as SearchableResource;

    if (
      typeof query !== "string" ||
      query.length > 200 ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100 ||
      !Array.isArray(filters) ||
      filters.length > 20 ||
      filters.some((filter) =>
        !filter ||
        typeof filter !== "object" ||
        typeof filter.field !== "string" ||
        !filterFields[typedResource][filter.field] ||
        !filterFields[typedResource][filter.field].operators.includes(filter.operator) ||
        (filter.operator === "between"
          ? !Array.isArray(filter.value) ||
            filter.value.length !== 2 ||
            !filter.value.every((value: unknown) => !Array.isArray(value) && isValidFilterValue(value, filterFields[typedResource][filter.field]))
          : filter.operator === "in"
            ? !isValidFilterValue(filter.value, filterFields[typedResource][filter.field])
            : Array.isArray(filter.value) || !isValidFilterValue(filter.value, filterFields[typedResource][filter.field]))
      )
    ) {
      return badRequestResponse("Invalid search parameters");
    }

    const requestedSort = sort || { field: sortFields[typedResource][0], order: "asc" };
    if (
      typeof requestedSort.field !== "string" ||
      !sortFields[typedResource].includes(requestedSort.field) ||
      !["asc", "desc"].includes(requestedSort.order)
    ) {
      return badRequestResponse("Invalid sort options");
    }

    const scope = await getSearchScope(typedResource, session.user.role as Role, session.user.id);
    if (scope === false) {
      return forbiddenResponse("Insufficient permissions to search this resource", {
        userId: session.user.id,
        action: "POST",
        resource: "/api/search",
      });
    }

    const validatedFilters = filters.map((filter: NonNullable<SearchOptions["filters"]>[number]) => {
      const field = filterFields[typedResource][filter.field];
      const normalizeDate = (value: unknown) =>
        field.type === "date" ? new Date(value as string) : value;
      return {
        ...filter,
        value: Array.isArray(filter.value)
          ? filter.value.map(normalizeDate)
          : normalizeDate(filter.value),
      };
    });

    const options: SearchOptions = {
      query,
      filters: validatedFilters,
      sort: requestedSort,
      skip: (page - 1) * pageSize,
      take: pageSize,
      accessScope: scope,
    };

    let result;

    switch (resource) {
      case "students":
        result = await searchStudents(options);
        break;
      case "faculty":
        result = await searchFaculty(options);
        break;
      case "grades":
        result = await searchGrades(options);
        break;
      case "attendance":
        result = await searchAttendance(options);
        break;
      case "enrollments":
        result = await searchEnrollments(options);
        break;
      case "documents":
        result = await searchDocuments(options);
        break;
      default:
        return badRequestResponse("Invalid resource type");
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "search:data")) {
    return forbiddenResponse("Insufficient permissions to search", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/search",
    });
  }

  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  if (!resource) {
    return badRequestResponse("Resource type is required");
  }

  try {
    if (typeof resource !== "string" || !searchableResources.includes(resource as SearchableResource)) {
      return badRequestResponse("Invalid resource type");
    }
    const typedResource = resource as SearchableResource;
    const scope = await getSearchScope(typedResource, session.user.role as Role, session.user.id);
    if (scope === false) {
      return forbiddenResponse("Insufficient permissions to search this resource", {
        userId: session.user.id,
        action: "GET",
        resource: "/api/search",
      });
    }

    const filterOptions = await getFilterOptions(resource);
    return NextResponse.json({
      resource,
      filters: filterOptions,
    });
  } catch (err) {
    console.error("Filter options error:", err);
    return NextResponse.json(
      { error: "Failed to fetch filter options" },
      { status: 500 }
    );
  }
}
