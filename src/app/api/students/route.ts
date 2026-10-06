import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-responses";
import { parsePaginationParams, getPaginationSkipTake, createPaginatedResponse } from "@/lib/pagination";

const ALLOWED_STUDENT_FIELDS = [
  "firstName", "middleName", "lastName", "extensionName", "gender",
  "birthDate", "birthPlace", "nationality", "religion", "address",
  "barangay", "city", "province", "zipCode", "motherTongue",
  "bloodType", "fatherName", "fatherOccupation", "motherName",
  "motherOccupation", "guardianName", "guardianRelationship",
  "guardianContact", "guardianAddress", "emergencyContactName",
  "emergencyContactNumber", "emergencyContactRelation"
];

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "student:view")) {
    return forbiddenResponse("Insufficient permissions to view students", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/students",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);

  const [students, totalCount] = await Promise.all([
    prisma.student.findMany({
      skip,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        lrn: true,
        firstName: true,
        middleName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        address: true,
        status: true,
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
    prisma.student.count(),
  ]);

  return NextResponse.json(createPaginatedResponse(students, page, pageSize, totalCount));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "student:manage")) {
    return forbiddenResponse("Insufficient permissions to create students", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/students",
    });
  }

  const body = await request.json();
  const { lrn, firstName, middleName, lastName, extensionName, gender, birthDate, address } = body;

  if (!lrn || !firstName || !lastName || !gender || !birthDate || !address) {
    return badRequestResponse("LRN, first name, last name, gender, birth date, and address are required");
  }

  const birthDateObj = new Date(birthDate);
  if (isNaN(birthDateObj.getTime())) {
    return badRequestResponse("Invalid birth date format");
  }

  const existing = await prisma.student.findUnique({ where: { lrn } });
  if (existing) {
    return conflictResponse("LRN already exists");
  }

  const student = await prisma.$transaction(async (transaction) => {
    const created = await transaction.student.create({
      data: {
        lrn,
        firstName,
        middleName: middleName || null,
        lastName,
        extensionName: extensionName || null,
        gender,
        birthDate: birthDateObj,
        address,
        createdById: session.user.id,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "STUDENT_CREATED",
        entityType: "STUDENT",
        entityId: created.id,
        performedById: session.user.id,
        details: { lrn: created.lrn },
      },
    });
    return created;
  });

  return NextResponse.json(student, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "student:manage")) {
    return forbiddenResponse("Insufficient permissions to update students", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/students",
    });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return badRequestResponse("Student ID is required");
  }

  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse("Student");
  }

  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_STUDENT_FIELDS.includes(key)) {
      if (key === "birthDate" && value) {
        const dateObj = new Date(value as string);
        if (isNaN(dateObj.getTime())) {
          return badRequestResponse(`Invalid ${key} format`);
        }
        updateData[key] = dateObj;
      } else {
        updateData[key] = value;
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return badRequestResponse("No valid fields provided for update");
  }

  const student = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.student.update({
      where: { id },
      data: { ...updateData, updatedById: session.user.id },
    });
    await transaction.auditLog.create({
      data: {
        action: "STUDENT_UPDATED",
        entityType: "STUDENT",
        entityId: id,
        performedById: session.user.id,
        details: { fields: Object.keys(updateData) },
      },
    });
    return updated;
  });

  return NextResponse.json(student);
}