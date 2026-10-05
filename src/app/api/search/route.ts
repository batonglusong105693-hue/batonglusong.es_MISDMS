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
      sort = { field: "id", order: "asc" },
      page = 1,
      pageSize = 20,
    } = body;

    if (!resource) {
      return badRequestResponse("Resource type is required");
    }

    const validResources = [
      "students",
      "faculty",
      "grades",
      "attendance",
      "enrollments",
      "documents",
    ];
    if (!validResources.includes(resource)) {
      return badRequestResponse("Invalid resource type");
    }

    const skip = (page - 1) * pageSize;
    const options: SearchOptions = {
      query,
      filters,
      sort,
      skip,
      take: Math.min(pageSize, 100),
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
