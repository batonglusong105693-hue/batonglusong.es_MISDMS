import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFoundResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-responses";
import { getSupabaseStorage, STORAGE_BUCKET } from "@/lib/supabase-storage";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();
  if (!hasPermission(session.user.role as Role, "file:view")) {
    return forbiddenResponse("Insufficient permissions to view files", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/upload",
    });
  }

  const { fileName: fileId } = await params;
  const file = await prisma.uploadedFile.findUnique({ where: { id: fileId } });
  if (!file) return notFoundResponse("File");

  const url = new URL(request.url);
  const previewOnly = url.searchParams.get("preview") === "1" || url.searchParams.get("preview") === "true";

  try {
    const { data, error } = await getSupabaseStorage().storage.from(STORAGE_BUCKET).download(file.fileName);
    if (error || !data) return notFoundResponse("File");

    const content = Buffer.from(await data.arrayBuffer());
    return new NextResponse(content, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": previewOnly
          ? `inline; filename="${file.originalName.replace(/"/g, "")}"`
          : `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return notFoundResponse("File");
  }
}