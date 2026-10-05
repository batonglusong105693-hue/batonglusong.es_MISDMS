import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";
import { formatFileSize, validateFileUpload } from "@/lib/file-upload";
import { getSupabaseStorage, STORAGE_BUCKET } from "@/lib/supabase-storage";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const canUpload = hasPermission(session.user.role as Role, "file:upload") ||
    hasPermission(session.user.role as Role, "document:manage");
  if (!canUpload) {
    return forbiddenResponse("Insufficient permissions to upload files", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/upload/complete",
    });
  }

  try {
    const body = await request.json();
    const originalName = typeof body.originalName === "string" ? body.originalName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const path = typeof body.path === "string" ? body.path : "";
    const category = typeof body.category === "string" ? body.category : "";
    const expectedPrefix = `uploads/${session.user.id}/`;

    if (!path.startsWith(expectedPrefix) || path.includes("..")) {
      return badRequestResponse("Invalid storage path");
    }

    const validation = validateFileUpload(originalName, fileSize, mimeType, category as never);
    if (!validation.valid) return badRequestResponse(validation.error || "Invalid file details");

    const { data: object, error: headError } = await getSupabaseStorage()
      .storage
      .from(STORAGE_BUCKET)
      .list(`uploads/${session.user.id}`, { search: path.split("/").pop() });

    if (headError || !object?.some((entry: { name: string }) => `uploads/${session.user.id}/${entry.name}` === path)) {
      return badRequestResponse("Uploaded object was not found");
    }

    const uploadedFile = await prisma.uploadedFile.create({
      data: {
        originalName,
        fileName: path,
        filePath: `/api/upload/${encodeURIComponent(path)}`,
        fileSize,
        mimeType,
        category,
        uploadedById: session.user.id,
        isPublic: false,
        metadata: body.metadata || undefined,
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    return NextResponse.json({
      id: uploadedFile.id,
      originalName: uploadedFile.originalName,
      fileName: uploadedFile.fileName,
      filePath: `/api/upload/${uploadedFile.id}`,
      fileSize: uploadedFile.fileSize,
      fileSizeFormatted: formatFileSize(uploadedFile.fileSize),
      mimeType: uploadedFile.mimeType,
      category: uploadedFile.category,
      uploadedAt: uploadedFile.uploadedAt,
      uploadedBy: uploadedFile.uploadedBy?.name,
      isPublic: uploadedFile.isPublic,
    });
  } catch (error) {
    console.error("Error completing upload:", error);
    return NextResponse.json({ error: "Failed to save uploaded file metadata" }, { status: 500 });
  }
}