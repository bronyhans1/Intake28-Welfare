import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { ReportAuditAction } from "@/lib/reports/audit";
import { exportContributions } from "@/lib/reports/export/contributions";
import { exportDefaulters } from "@/lib/reports/export/defaulters";
import { exportMembershipProgression } from "@/lib/reports/export/membership-progression";
import { exportOutstandingContributions } from "@/lib/reports/export/outstanding-contributions";
import { exportReceipts } from "@/lib/reports/export/receipts";
import { exportWelfareSupport } from "@/lib/reports/export/welfare-support";
import {
  ExportFormat,
  ReportType,
  type ExportFile,
  type ReportExportFilters,
} from "@/lib/reports/types";
import type { CurrentUser } from "@/types/auth";

export function sanitizeReportExportFilters(
  filters: ReportExportFilters,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export async function exportReport(
  reportType: ReportType,
  format: ExportFormat,
  filters: ReportExportFilters,
  actor: CurrentUser,
): Promise<ExportFile> {
  let file: ExportFile;

  switch (reportType) {
    case ReportType.CONTRIBUTIONS:
      file = await exportContributions(format, filters);
      break;
    case ReportType.WELFARE_SUPPORT:
      file = await exportWelfareSupport(format, filters);
      break;
    case ReportType.DEFAULTERS:
      file = await exportDefaulters(format, filters);
      break;
    case ReportType.RECEIPTS:
      file = await exportReceipts(format, filters);
      break;
    case ReportType.MEMBERSHIP_PROGRESSION:
      file = await exportMembershipProgression(format);
      break;
    case ReportType.OUTSTANDING_CONTRIBUTIONS:
      file = await exportOutstandingContributions(format, {
        memberId: filters.memberId,
        search: filters.search,
        status: filters.status,
      });
      break;
    default:
      throw new Error("Unsupported report type.");
  }

  await createAuditLog({
    action: ReportAuditAction.REPORT_EXPORTED,
    entityType: "report",
    entityId: reportType,
    ...buildAuditActor(actor),
    metadata: {
      reportType,
      format,
      filtersUsed: sanitizeReportExportFilters(filters),
    },
  });

  return file;
}
