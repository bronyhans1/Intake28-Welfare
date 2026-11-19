import { z } from "zod";
import { ContributionStatus, ContributionType } from "@/types/enums";

const MIN_YEAR = 2020;
const MAX_YEAR = new Date().getFullYear() + 1;

const CONTRIBUTION_TYPES = [
  ContributionType.MONTHLY_DUES,
  ContributionType.SPECIAL_CONTRIBUTION,
  ContributionType.WELFARE_FUND,
  ContributionType.OTHER,
] as const;

const CONTRIBUTION_STATUSES = [
  ContributionStatus.PENDING,
  ContributionStatus.PAID,
  ContributionStatus.WAIVED,
  ContributionStatus.CANCELLED,
] as const;

export const contributionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  contributionType: z.enum(CONTRIBUTION_TYPES).optional(),
  status: z.enum(CONTRIBUTION_STATUSES).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
  memberId: z.string().optional(),
});

export type ContributionListQuery = z.infer<typeof contributionListQuerySchema>;

export const createContributionSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  memberName: z.string().min(1, "Member name is required"),
  serviceNumber: z.string().min(1, "Service number is required"),
  contributionType: z.enum(CONTRIBUTION_TYPES, {
    message: "Select a valid contribution type",
  }),
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  month: z.number().int().min(1, "Month is required").max(12, "Month must be 1-12"),
  year: z
    .number()
    .int()
    .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
    .max(MAX_YEAR, "Year is out of range"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export type CreateContributionInput = z.infer<typeof createContributionSchema>;

export const updateContributionSchema = z.object({
  contributionType: z.enum(CONTRIBUTION_TYPES, {
    message: "Select a valid contribution type",
  }),
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  remarks: z.string().trim().max(500).optional().nullable(),
});

export type UpdateContributionInput = z.infer<typeof updateContributionSchema>;
