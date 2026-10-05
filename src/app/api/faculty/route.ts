import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password-validator";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse, conflictResponse } from "@/lib/api-responses";
import { parsePaginationParams, getPaginationSkipTake, createPaginatedResponse } from "@/lib/pagination";
import bcrypt from "bcryptjs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "faculty:view")) {
    return forbiddenResponse("Insufficient permissions to view faculty", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/faculty",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        advisories: {
          select: { id: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
  ]);

  const faculty = users.map((u: { advisories: { id: string }[] }) => ({
    ...u,
    isAdviser: u.advisories.length > 0,
  }));

  return NextResponse.json(createPaginatedResponse(faculty, page, pageSize, totalCount));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "faculty:manage")) {
    return forbiddenResponse("Insufficient permissions to create faculty", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/faculty",
    });
  }

  const body = await request.json();
  const { name, email, password, role, department } = body;

  if (!name || !email || !password || !role) {
    return badRequestResponse("Name, email, password, and role are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequestResponse("Invalid email format");
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return NextResponse.json(
      { error: "Password does not meet requirements", details: passwordValidation.errors },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return conflictResponse("Email already exists");
  }

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role,
      department: department || null,
      status: "ACTIVE",
    },
    select: {
      id: true, name: true, email: true, role: true, department: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (session.user.role !== "SUPER_ADMIN") {
    return forbiddenResponse("Only superadmin can update user accounts", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/faculty",
    });
  }

  const body = await request.json();
  const { id, name, email, role, department, status } = body;

  if (!id || !name || !email || !role) {
    return badRequestResponse("User id, name, email, and role are required");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return badRequestResponse("Invalid email format");
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse("User");
  }

  const emailOwner = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (emailOwner && emailOwner.id !== id) {
    return conflictResponse("Email already exists");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      name,
      email: email.toLowerCase(),
      role,
      department: department || null,
      status: status || existing.status,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      status: true,
    },
  });

  return NextResponse.json(user);
}