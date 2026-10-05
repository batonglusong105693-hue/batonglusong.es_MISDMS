import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  forbiddenResponse,
  unauthorizedResponse,
  badRequestResponse,
  notFoundResponse,
} from "@/lib/api-responses";
import {
  parsePaginationParams,
  getPaginationSkipTake,
  createPaginatedResponse,
} from "@/lib/pagination";

function normalizeInventoryRecord(document: any) {
  const metadata = document.metadata ?? {};

  return {
    id: document.id,
    title: document.title,
    description: document.description,
    itemCode: metadata.itemCode ?? document.referenceNumber ?? "",
    quantity: metadata.quantity ?? 0,
    unit: metadata.unit ?? "pcs",
    location: metadata.location ?? document.recipient ?? "",
    condition: metadata.condition ?? "GOOD",
    supplier: metadata.supplier ?? document.sender ?? "",
    assignedTo: metadata.assignedTo ?? "",
    serialNumber: metadata.serialNumber ?? "",
    purchaseDate: metadata.purchaseDate ?? null,
    status: document.status,
    referenceNumber: document.referenceNumber,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    uploadedBy: document.uploadedBy ? { name: document.uploadedBy.name } : null,
  };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "inventory:view")) {
    return forbiddenResponse("Insufficient permissions to view inventory", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/inventory",
    });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize } = parsePaginationParams({
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || undefined,
  });
  const { skip, take } = getPaginationSkipTake(page, pageSize);
  const search = searchParams.get("search")?.trim() || "";

  const where: any = {
    category: "INVENTORY",
    status: { not: "ARCHIVED" },
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { sender: { contains: search, mode: "insensitive" } },
      { recipient: { contains: search, mode: "insensitive" } },
    ];
  }

  const [documents, totalCount] = await Promise.all([
    prisma.document.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);

  return NextResponse.json(
    createPaginatedResponse(
      documents.map(normalizeInventoryRecord),
      page,
      pageSize,
      totalCount
    )
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "inventory:manage")) {
    return forbiddenResponse("Insufficient permissions to manage inventory", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/inventory",
    });
  }

  const body = await request.json();
  const {
    title,
    itemCode,
    quantity,
    unit,
    location,
    condition,
    supplier,
    assignedTo,
    serialNumber,
    purchaseDate,
    description,
  } = body;

  if (!title?.trim()) {
    return badRequestResponse("Item name is required");
  }

  const normalizedQty = Number(quantity ?? 0);
  if (!Number.isFinite(normalizedQty) || normalizedQty < 0) {
    return badRequestResponse("Quantity must be a valid non-negative number");
  }

  const metadata = {
    itemCode: itemCode?.trim() || undefined,
    quantity: normalizedQty,
    unit: unit?.trim() || "pcs",
    location: location?.trim() || "Main Office",
    condition: condition || "GOOD",
    supplier: supplier?.trim() || "",
    assignedTo: assignedTo?.trim() || "",
    serialNumber: serialNumber?.trim() || "",
    purchaseDate: purchaseDate || null,
  };

  const document = await prisma.document.create({
    data: {
      title: title.trim(),
      description: description?.trim() || "",
      category: "INVENTORY",
      status: "APPROVED",
      referenceNumber: metadata.itemCode || `INV-${Date.now()}`,
      sender: metadata.supplier || "School Admin",
      recipient: metadata.location || "Main Office",
      metadata: metadata as Record<string, string | number | boolean | null>,
      isConfidential: false,
      uploadedById: session.user.id,
      createdById: session.user.id,
    },
    include: { uploadedBy: { select: { name: true } } },
  });

  await prisma.documentAuditLog.create({
    data: {
      documentId: document.id,
      action: "CREATED",
      performedById: session.user.id,
      details: `Inventory item added: ${document.title}`,
    },
  });

  return NextResponse.json(normalizeInventoryRecord(document), { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "inventory:manage")) {
    return forbiddenResponse("Insufficient permissions to edit inventory", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/inventory",
    });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return badRequestResponse("Inventory item ID is required");

  const existing = await prisma.document.findFirst({
    where: { id, category: "INVENTORY", status: { not: "ARCHIVED" } },
  });
  if (!existing) return notFoundResponse("Inventory item");

  const metadata = existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
    ? { ...(existing.metadata as Record<string, unknown>) }
    : {};
  const nextTitle = updates.title?.trim() ?? existing.title;
  const nextDescription = updates.description?.trim() ?? existing.description ?? "";

  if (updates.itemCode !== undefined) metadata.itemCode = updates.itemCode?.trim() || undefined;
  if (updates.quantity !== undefined) metadata.quantity = Number(updates.quantity) || 0;
  if (updates.unit !== undefined) metadata.unit = updates.unit?.trim() || "pcs";
  if (updates.location !== undefined) metadata.location = updates.location?.trim() || "Main Office";
  if (updates.condition !== undefined) metadata.condition = updates.condition || "GOOD";
  if (updates.supplier !== undefined) metadata.supplier = updates.supplier?.trim() || "";
  if (updates.assignedTo !== undefined) metadata.assignedTo = updates.assignedTo?.trim() || "";
  if (updates.serialNumber !== undefined) metadata.serialNumber = updates.serialNumber?.trim() || "";
  if (updates.purchaseDate !== undefined) metadata.purchaseDate = updates.purchaseDate || null;

  const updated = await prisma.document.update({
    where: { id },
    data: {
      title: nextTitle,
      description: nextDescription,
      referenceNumber: metadata.itemCode || existing.referenceNumber || `INV-${Date.now()}`,
      sender: metadata.supplier || existing.sender || "School Admin",
      recipient: metadata.location || existing.recipient || "Main Office",
      status: updates.status || existing.status,
      metadata: metadata as any,
    },
    include: { uploadedBy: { select: { name: true } } },
  });

  await prisma.documentAuditLog.create({
    data: {
      documentId: updated.id,
      action: "UPDATED",
      performedById: session.user.id,
      details: `Inventory item updated: ${updated.title}`,
    },
  });

  return NextResponse.json(normalizeInventoryRecord(updated));
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "inventory:manage")) {
    return forbiddenResponse("Insufficient permissions to delete inventory", {
      userId: session.user.id,
      action: "DELETE",
      resource: "/api/inventory",
    });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return badRequestResponse("Inventory item ID is required");

  const item = await prisma.document.findFirst({
    where: { id, category: "INVENTORY", status: { not: "ARCHIVED" } },
  });
  if (!item) return notFoundResponse("Inventory item");

  const archived = await prisma.document.update({
    where: { id },
    data: {
      status: "ARCHIVED",
      metadata: {
        ...(item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
          ? (item.metadata as Record<string, unknown>)
          : {}),
        archivedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.documentAuditLog.create({
    data: {
      documentId: archived.id,
      action: "ARCHIVED",
      performedById: session.user.id,
      details: `Inventory item archived: ${archived.title}`,
    },
  });

  return NextResponse.json({ success: true, item: normalizeInventoryRecord(archived) });
}
