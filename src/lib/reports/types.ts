export const ReportType = {
  CONTRIBUTIONS: "contributions",
  WELFARE_SUPPORT: "welfare_support",
  DEFAULTERS: "defaulters",
  RECEIPTS: "receipts",
  MEMBERSHIP_PROGRESSION: "membership_progression",
  OUTSTANDING_CONTRIBUTIONS: "outstanding_contributions",
} as const;

export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const ExportFormat = {
  CSV: "csv",
  XLSX: "xlsx",
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export interface ExportFile {
  content: Buffer;
  contentType: string;
  filename: string;
}

export interface ReportExportFilters {
  month?: number;
  year?: number;
  memberId?: string;
  contributionType?: string;
  supportType?: string;
  search?: string;
  status?: string;
}
