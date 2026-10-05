import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import {
  createReportTemplate,
  listReportTemplates,
  deleteReportTemplate,
  updateReportTemplate,
  generateClassRecordReport,
  generateMasterListReport,
  generateAttendanceReport,
  convertToCSV,
  convertToJSON,
  type ReportConfig,
} from "@/lib/report-customization";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse } from "@/lib/api-responses";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "reports:generate")) {
    return forbiddenResponse("Insufficient permissions to generate reports", {
      userId: session.user.id,
      action: "POST",
      resource: "/api/reports/custom",
    });
  }

  try {
    const body = await request.json();
    const { action, template, reportType, sectionId, subjectId, quarter, startDate, endDate, format = "csv" } = body;

    if (action === "save_template") {
      const saved = await createReportTemplate({
        name: template.name,
        description: template.description || "",
        type: template.type,
        fields: template.fields,
        filters: template.filters || {},
        sorting: template.sorting || [],
        createdBy: session.user.id,
        isDefault: false,
      });

      return NextResponse.json({
        success: true,
        template: saved,
      });
    }

    if (action === "update_template") {
      if (!template?.id) {
        return badRequestResponse("Template ID is required");
      }

      const updated = await updateReportTemplate(template.id, {
        name: template.name,
        description: template.description || "",
        type: template.type,
        fields: template.fields,
        filters: template.filters || {},
        sorting: template.sorting || [],
        createdBy: session.user.id,
        isDefault: false,
      });

      return NextResponse.json({
        success: true,
        template: updated,
      });
    }

    if (action === "generate") {
      if (!reportType || !sectionId) {
        return badRequestResponse("Report type and section ID are required");
      }

      const config: ReportConfig = {
        type: reportType,
        fields: template?.fields || [],
        filters: template?.filters,
        sorting: template?.sorting,
        format,
        includeStats: template?.includeStats !== false,
      };

      let data: any[] = [];

      switch (reportType) {
        case "class_record":
          if (!subjectId || !quarter) {
            return badRequestResponse("Subject ID and quarter are required for class records");
          }
          data = await generateClassRecordReport(config, sectionId, subjectId, quarter);
          break;

        case "master_list":
          if (!quarter) {
            return badRequestResponse("Quarter is required for master lists");
          }
          data = await generateMasterListReport(config, sectionId, quarter);
          break;

        case "attendance":
          data = await generateAttendanceReport(
            config,
            sectionId,
            startDate ? new Date(startDate) : undefined,
            endDate ? new Date(endDate) : undefined
          );
          break;

        default:
          return badRequestResponse("Invalid report type");
      }

      // Convert format
      let content: string;
      let mimeType: string;
      let filename: string;

      if (format === "json") {
        content = convertToJSON(data);
        mimeType = "application/json";
        filename = `${reportType}-${Date.now()}.json`;
      } else {
        content = convertToCSV(data, config.fields);
        mimeType = "text/csv";
        filename = `${reportType}-${Date.now()}.csv`;
      }

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return badRequestResponse("Invalid action");
  } catch (err) {
    console.error("Report generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "reports:view")) {
    return forbiddenResponse("Insufficient permissions to view reports", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/reports/custom",
    });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    const templates = await listReportTemplates(session.user.id, type || undefined);

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        fields: t.fields,
        isDefault: t.isDefault,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    console.error("Template retrieval error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve templates" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorizedResponse();

  if (!hasPermission(session.user.role as Role, "reports:manage")) {
    return forbiddenResponse("Insufficient permissions to manage reports", {
      userId: session.user.id,
      action: "DELETE",
      resource: "/api/reports/custom",
    });
  }

  try {
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return badRequestResponse("Template ID is required");
    }

    await deleteReportTemplate(templateId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Template deletion error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete template" },
      { status: 500 }
    );
  }
}
