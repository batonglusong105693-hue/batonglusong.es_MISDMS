import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";
import { formatFileSize } from "@/lib/file-upload";
import { getSupabaseStorage, STORAGE_BUCKET } from "@/lib/supabase-storage";

export async function POST() {
  return badRequestResponse("Use the signed upload flow at /api/upload/sign and /api/upload/complete");
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "file:view")) {
    return forbiddenResponse("Insufficient permissions to view files", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/upload",
    });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100);
  const skip = (page - 1) * pageSize;

  try {
    const [files, total] = await Promise.all([
      prisma.uploadedFile.findMany({
        skip,
        take: pageSize,
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
        },
      }),
      prisma.uploadedFile.count(),
    ]);

    const formattedFiles = files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      fileName: f.fileName,
      filePath: `/api/upload/${f.id}`,
      fileSize: f.fileSize,
      fileSizeFormatted: formatFileSize(f.fileSize),
      mimeType: f.mimeType,
      category: f.category,
      uploadedAt: f.uploadedAt,
      uploadedBy: f.uploadedBy?.name,
      isPublic: f.isPublic,
    }));

    return NextResponse.json({
      files: formattedFiles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("Error fetching files:", err);
    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "file:manage")) {
    return forbiddenResponse("Insufficient permissions to delete files", {
      userId: session.user.id,
      action: "DELETE",
      resource: "/api/upload",
    });
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return badRequestResponse("File ID is required");
  }

  try {
    const file = await prisma.uploadedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { error: storageError } = await getSupabaseStorage()
      .storage
      .from(STORAGE_BUCKET)
      .remove([file.fileName]);

    if (storageError) throw storageError;

    await prisma.uploadedFile.delete({
      where: { id: fileId },
    });

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting file:", err);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
