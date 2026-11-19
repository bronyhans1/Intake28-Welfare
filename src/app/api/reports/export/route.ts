import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import { exportReport } from "@/lib/reports/export/service";
import { canExportReports } from "@/lib/reports/permissions";
import { ReportType, type ExportFormat } from "@/lib/reports/types";
import { reportExportQuerySchema } from "@/lib/validators/reports";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canExportReports(actor.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = reportExportQuerySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export parameters" }, { status: 400 });
  }

  const { reportType, format, month, year, memberId, contributionType, supportType, search, status } =
    parsed.data;

  try {
    const file = await exportReport(
      reportType as ReportType,
      format as ExportFormat,
      { month, year, memberId, contributionType, supportType, search, status },
      actor,
    );

    return new NextResponse(new Uint8Array(file.content), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
