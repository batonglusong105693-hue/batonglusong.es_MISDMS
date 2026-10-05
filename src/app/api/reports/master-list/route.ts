import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, hasPermission, type Role } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse, badRequestResponse, notFoundResponse } from "@/lib/api-responses";
import { getMasterListData, generateCSVFromMasterList } from "@/lib/report-generator";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return unauthorizedResponse();
  }

  if (!hasPermission(session.user.role as Role, "report:view")) {
    return forbiddenResponse("Insufficient permissions to view reports", {
      userId: session.user.id,
      action: "GET",
      resource: "/api/reports/master-list",
    });
  }

  const { searchParams } = new URL(request.url);
  const sectionId = searchParams.get("sectionId");
  const quarter = searchParams.get("quarter") || "FIRST";

  if (!sectionId) {
    return badRequestResponse("Section ID is required");
  }

  if (!["FIRST", "SECOND", "THIRD", "FOURTH"].includes(quarter)) {
    return badRequestResponse("Invalid quarter");
  }

  try {
    const data = await getMasterListData(sectionId, quarter as any);
    if (!data) {
      return notFoundResponse("Master List");
    }

    const format = searchParams.get("format");
    if (format === "csv") {
      const csv = generateCSVFromMasterList(data);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="master-list-${sectionId}-${quarter}.csv"`,
        },
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error generating master list:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
