import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { badRequestResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-responses";
import { generateFileName, getFileCategory, validateFileUpload } from "@/lib/file-upload";
import { getSupabaseStorage, STORAGE_BUCKET } from "@/lib/supabase-storage";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const canUpload = hasPermission(session.user.role as Role, "file:upload") ||
    hasPermission(session.user.role as Role, "document:manage");
  if (!canUpload) {
    return forbiddenResponse("Insufficient permissions to upload files", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/upload/sign",
    });
  }

  try {
    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    const category = getFileCategory(mimeType);
    const validation = validateFileUpload(fileName, fileSize, mimeType, category);

    if (!fileName || !fileSize || !mimeType || !validation.valid) {
      return badRequestResponse(validation.error || "Invalid file details");
    }

    const storagePath = `uploads/${session.user.id}/${generateFileName(fileName)}`;
    const { data, error } = await getSupabaseStorage()
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new Error(error?.message || "Could not create upload URL");
    }

    return NextResponse.json({
      path: storagePath,
      token: data.token,
      category,
    });
  } catch (error) {
    console.error("Error creating upload URL:", error);
    return NextResponse.json({ error: "File storage is not configured or unavailable" }, { status: 503 });
  }
}