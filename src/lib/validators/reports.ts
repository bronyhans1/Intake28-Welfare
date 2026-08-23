import { z } from "zod";
import { ContributionType } from "@/types/enums";
import { welfareSupportTypeCodeSchema } from "@/lib/welfare-support-types/validation";

const MIN_YEAR = 2020;
const MAX_YEAR = new Date().getFullYear() + 1;

const CONTRIBUTION_TYPES = [
  ContributionType.MONTHLY_DUES,
  ContributionType.SPECIAL_CONTRIBUTION,
  ContributionType.WELFARE_FUND,
  ContributionType.OTHER,
] as const;

export const reportsPageQuerySchema = z.object({
  tab: z
    .enum([
      "financial",
      "contributions",
      "welfare",
      "defaulters",
      "receipts",
      "progression",
      "outstanding",
    ])
    .default("financial"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
  memberId: z.string().optional(),
  contributionType: z.enum(CONTRIBUTION_TYPES).optional(),
  supportType: welfareSupportTypeCodeSchema.optional(),
  search: z.string().optional(),
  status: z
    .enum(["all", "active", "defaulting", "lapsed"])
    .optional(),
});

export type ReportsPageQuery = z.infer<typeof reportsPageQuerySchema>;

export const reportExportQuerySchema = z.object({
  reportType: z.enum([
    "contributions",
    "welfare_support",
    "defaulters",
    "receipts",
    "membership_progression",
    "outstanding_contributions",
  ]),
  format: z.enum(["csv", "xlsx"]),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
  memberId: z.string().optional(),
  contributionType: z.enum(CONTRIBUTION_TYPES).optional(),
  supportType: welfareSupportTypeCodeSchema.optional(),
  search: z.string().optional(),
  status: z.string().optional(),
});

export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
