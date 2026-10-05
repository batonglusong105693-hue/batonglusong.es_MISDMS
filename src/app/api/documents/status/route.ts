import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { badRequestResponse, forbiddenResponse, notFoundResponse, unauthorizedResponse } from "@/lib/api-responses";
import { prisma } from "@/lib/prisma";

const transitions = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["RELEASED", "ARCHIVED"],
  RELEASED: ["ARCHIVED"],
  REJECTED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
} as const;

type DocumentStatus = keyof typeof transitions;

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  const body = await request.json();
  const id = typeof body.id === "string" ? body.id : "";
  const nextStatus = typeof body.status === "string" ? body.status as DocumentStatus : null;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const receiverName = typeof body.receiverName === "string" ? body.receiverName.trim() : "Internal Distribution";
  const receiverType = typeof body.receiverType === "string" ? body.receiverType : "STAFF";
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "Document release";

  if (!id || !nextStatus || !Object.prototype.hasOwnProperty.call(transitions, nextStatus)) {
    return badRequestResponse("Document ID and a valid status are required");
  }

  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) return notFoundResponse("Document");

  const currentStatus = document.status as DocumentStatus;
  if (!(transitions[currentStatus] as readonly string[]).includes(nextStatus)) {
    return badRequestResponse(`Cannot change status from ${currentStatus} to ${nextStatus}`);
  }

  const needsApproval = nextStatus === "APPROVED" || nextStatus === "REJECTED";
  const needsRelease = nextStatus === "RELEASED";
  const needsManage = nextStatus === "PENDING_REVIEW" || nextStatus === "DRAFT" || nextStatus === "ARCHIVED";
  const allowed = (needsApproval && hasPermission(session.user.role as Role, "document:approve"))
    || (needsRelease && hasPermission(session.user.role as Role, "document:release"))
    || (needsManage && hasPermission(session.user.role as Role, "document:manage"));

  if (!allowed) {
    return forbiddenResponse("You do not have permission to make this status change", {
      userId: session.user.id,
      action: "PATCH",
      resource: "/api/documents/status",
    });
  }

  if (nextStatus === "REJECTED" && !reason) {
    return badRequestResponse("A reason is required when rejecting a document");
  }

  const updatedDocument = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.document.update({
      where: { id },
      data: { status: nextStatus },
    });

    if (nextStatus === "RELEASED") {
      await transaction.documentReleaseLog.create({
        data: {
          documentId: id,
          releasedById: session.user.id,
          receiverName,
          receiverType,
          purpose,
          status: "OUT",
          dateReleased: new Date(),
        },
      });
    }

    await transaction.documentAuditLog.create({
      data: {
        documentId: id,
        action: nextStatus === "APPROVED" ? "APPROVED" : nextStatus === "REJECTED" ? "REJECTED" : nextStatus === "RELEASED" ? "RELEASED" : nextStatus === "ARCHIVED" ? "ARCHIVED" : "UPDATED",
        performedById: session.user.id,
        details: `Status changed from ${currentStatus} to ${nextStatus}${reason ? `: ${reason}` : ""}${nextStatus === "RELEASED" ? ` | Recipient: ${receiverName}` : ""}`,
      },
    });

    return updated;
  });

  return NextResponse.json(updatedDocument);
}