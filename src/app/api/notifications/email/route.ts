import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";
import { sendEmail, getEmailTemplate, type EmailNotification, type EmailTemplate } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "notification:send")) {
    return forbiddenResponse("Insufficient permissions to send notifications", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/notifications/email",
    });
  }

  const body = await request.json();
  const { to, subject, template, data } = body;

  if (!to || !template || !data) {
    return badRequestResponse("Email, template, and data are required");
  }

  try {
    const result = await sendEmail({
      to,
      subject: subject || getEmailTemplate(template as EmailTemplate, data).subject,
      template: template as EmailTemplate,
      data,
      isHtml: true,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Log notification in database
    await prisma.notification.create({
      data: {
        type: "EMAIL",
        recipient: to,
        template,
        subject: result.messageId || undefined,
        status: "SENT",
        sentAt: new Date(),
        sentById: session.user.id,
        metadata: data,
      },
    }).catch((err) => console.error("Error logging notification:", err));

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error("Error sending email:", err);
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "notification:view")) {
    return forbiddenResponse("Insufficient permissions to view notifications", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/notifications/email",
    });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "20"), 100);
  const skip = (page - 1) * pageSize;

  try {
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        where: { type: "EMAIL" },
        include: {
          sentBy: { select: { name: true } },
        },
      }),
      prisma.notification.count({ where: { type: "EMAIL" } }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
