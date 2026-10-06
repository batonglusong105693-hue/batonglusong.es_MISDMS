import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, unauthorizedResponse, badRequestResponse, notFoundResponse } from "@/lib/api-responses";
import { parsePaginationParams, getPaginationSkipTake, createPaginatedResponse } from "@/lib/pagination";

const documentCategories = [
  "ADMINISTRATIVE_ISSUANCE",
  "DEPED_ORDER",
  "DEPED_MEMORANDUM",
  "STUDENT_RECORD",
  "FINANCIAL_MOOE",
  "PROCUREMENT",
  "INVENTORY",
  "LESSON_PLAN",
  "SCHOOL_FORM",
  "CORRESPONDENCE",
  "MISCELLANEOUS",
] as const;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "document:view")) {
    return forbiddenResponse("Insufficient permissions to view documents", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/documents",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);
  const search = searchParams.get("search")?.trim() || "";
  const category = searchParams.get("category") || "";
  const view = searchParams.get("view") || "active";

  if (category && !documentCategories.includes(category as (typeof documentCategories)[number])) {
    return badRequestResponse("Invalid document category");
  }
  if (view !== "active" && view !== "archived") {
    return badRequestResponse("Invalid document view");
  }

  const role = session.user.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "PRINCIPAL" || role === "ADMIN_OFFICER";
  const where: any = {
    ...(isAdmin ? {} : { isConfidential: false }),
    status: view === "archived" ? "ARCHIVED" : { not: "ARCHIVED" },
  };

  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { sender: { contains: search, mode: "insensitive" } },
      { recipient: { contains: search, mode: "insensitive" } },
      { metadata: { path: ["customCategory"], string_contains: search, mode: "insensitive" } },
    ];
  }

  const [documents, totalCount] = await Promise.all([
    prisma.document.findMany({
      skip,
      take,
      where,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json(createPaginatedResponse(documents, page, pageSize, totalCount));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "document:manage")) {
    return forbiddenResponse("Insufficient permissions to create documents", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/documents",
    });
  }

  const body = await request.json();
  const {
    title,
    description,
    category,
    referenceNumber,
    sender,
    recipient,
    isConfidential,
    tags,
    metadata,
    fileUrl,
    fileType,
    fileSize,
    fileName,
  } = body;

  if (!title || !category) {
    return badRequestResponse("Title and category are required");
  }
  if (typeof title !== "string" || !title.trim()) {
    return badRequestResponse("Title must be a non-empty string");
  }
  if (isConfidential !== undefined && typeof isConfidential !== "boolean") {
    return badRequestResponse("Confidential flag must be a boolean");
  }
  if (fileSize !== undefined && fileSize !== null &&
      (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize < 0)) {
    return badRequestResponse("File size must be a non-negative integer");
  }
  if (fileUrl !== undefined && fileUrl !== null &&
      (typeof fileUrl !== "string" || !fileUrl.trim())) {
    return badRequestResponse("File URL must be a non-empty string or null");
  }

  if (!documentCategories.includes(category)) {
    return badRequestResponse("Invalid document category");
  }

  const documentMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
  if (category === "MISCELLANEOUS" && typeof documentMetadata.customCategory === "string") {
    documentMetadata.customCategory = documentMetadata.customCategory.trim().slice(0, 80);
  } else {
    delete documentMetadata.customCategory;
  }

  const document = await prisma.$transaction(async (transaction) => {
    const created = await transaction.document.create({
      data: {
        title: title.trim(),
        description,
        category,
        referenceNumber,
        sender,
        recipient,
        isConfidential: isConfidential ?? false,
        tags: tags || null,
        metadata: Object.keys(documentMetadata).length ? documentMetadata : null,
        fileUrl: typeof fileUrl === "string" ? fileUrl.trim() : null,
        fileType: typeof fileType === "string" ? fileType : null,
        fileSize: typeof fileSize === "number" ? fileSize : null,
        fileName: typeof fileName === "string" ? fileName : null,
        uploadedById: session.user.id,
        createdById: session.user.id,
        status: "PENDING_REVIEW",
      },
    });
    if (typeof fileUrl === "string" && fileUrl.trim()) {
      await transaction.documentVersion.create({
        data: {
          documentId: created.id,
          version: created.version,
          fileUrl: fileUrl.trim(),
          fileSize: typeof fileSize === "number" ? fileSize : null,
          changes: "Initial upload",
          uploadedById: session.user.id,
        },
      });
    }

    await transaction.documentAuditLog.create({
      data: {
        documentId: created.id,
        action: "CREATED",
        performedById: session.user.id,
        details: `Document "${title.trim()}" created`,
      },
    });
    return created;
  });

  return NextResponse.json(document, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "document:manage")) {
    return forbiddenResponse("Insufficient permissions to update documents", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/documents",
    });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return badRequestResponse("Document ID is required");
  }

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return notFoundResponse("Document");
  }

  if (updates.category !== undefined && !documentCategories.includes(updates.category)) {
    return badRequestResponse("Invalid document category");
  }
  if (updates.isConfidential !== undefined && typeof updates.isConfidential !== "boolean") {
    return badRequestResponse("Confidential flag must be a boolean");
  }
  if (updates.fileUrl !== undefined &&
      updates.fileUrl !== null &&
      (typeof updates.fileUrl !== "string" || !updates.fileUrl.trim())) {
    return badRequestResponse("File URL must be a non-empty string or null");
  }
  if (updates.fileSize !== undefined && updates.fileSize !== null &&
      (typeof updates.fileSize !== "number" || !Number.isSafeInteger(updates.fileSize) || updates.fileSize < 0)) {
    return badRequestResponse("File size must be a non-negative integer");
  }

  const allowedFields = ["title", "description", "category", "referenceNumber", "sender", "recipient", "isConfidential", "tags", "metadata", "fileUrl", "fileType", "fileSize", "fileName"];
  const filteredUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      filteredUpdates[key] = value;
    }
    if (typeof filteredUpdates.fileUrl === "string") {
      filteredUpdates.fileUrl = filteredUpdates.fileUrl.trim();
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    return badRequestResponse("No valid fields provided for update");
  }

  if (filteredUpdates.title !== undefined &&
      (typeof filteredUpdates.title !== "string" || !filteredUpdates.title.trim())) {
    return badRequestResponse("Title must be a non-empty string");
  }
  const fileChanged = filteredUpdates.fileUrl !== undefined &&
    filteredUpdates.fileUrl !== document.fileUrl;
  const nextFileUrl = fileChanged
    ? filteredUpdates.fileUrl
    : document.fileUrl;
  if (fileChanged && typeof nextFileUrl !== "string") {
    return badRequestResponse("A new file URL is required to create a document version");
  }
  if (fileChanged) {
    filteredUpdates.version = document.version + 1;
  }

  const updatedDocument = await prisma.$transaction(async (transaction) => {
    if (fileChanged && document.fileUrl) {
      const existingVersions = await transaction.documentVersion.count({
        where: { documentId: document.id },
      });
      if (existingVersions === 0) {
        await transaction.documentVersion.create({
          data: {
            documentId: document.id,
            version: document.version,
            fileUrl: document.fileUrl,
            fileSize: document.fileSize,
            changes: "Version history initialized",
            uploadedById: session.user.id,
          },
        });
      }
    }
    const updated = await transaction.document.update({
      where: { id },
      data: filteredUpdates,
    });
    if (fileChanged && typeof nextFileUrl === "string") {
      await transaction.documentVersion.create({
        data: {
          documentId: document.id,
          version: document.version + 1,
          fileUrl: nextFileUrl,
          fileSize: typeof filteredUpdates.fileSize === "number"
            ? filteredUpdates.fileSize
            : document.fileSize,
          changes: "File updated",
          uploadedById: session.user.id,
        },
      });
    }

    await transaction.documentAuditLog.create({
      data: {
        documentId: document.id,
        action: "UPDATED",
        performedById: session.user.id,
        details: `Document updated: ${Object.keys(filteredUpdates).join(", ")}`,
      },
    });
    return updated;
  });

  return NextResponse.json(updatedDocument);
}