import { z } from "zod";
import { WelfareSupportStatus } from "@/types/enums";
import { welfareSupportTypeCodeSchema } from "@/lib/welfare-support-types/validation";

export const createWelfareSupportSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  memberName: z.string().min(1, "Member name is required"),
  serviceNumber: z.string().min(1, "Service number is required"),
  supportType: welfareSupportTypeCodeSchema,
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  description: z.string().min(1, "Description is required"),
});

export type CreateWelfareSupportInput = z.infer<typeof createWelfareSupportSchema>;

export const updateWelfareSupportSchema = z.object({
  supportType: welfareSupportTypeCodeSchema,
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  description: z.string().min(1, "Description is required"),
});

export type UpdateWelfareSupportInput = z.infer<typeof updateWelfareSupportSchema>;

export const welfareHistorySourceSchema = z.enum([
  "all",
  "welfare_support",
  "claim_payment",
]);

export type WelfareHistorySourceFilter = z.infer<
  typeof welfareHistorySourceSchema
>;

export const welfareSupportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  source: welfareHistorySourceSchema.optional(),
  supportType: welfareSupportTypeCodeSchema.optional(),
  status: z
    .enum([
      WelfareSupportStatus.PENDING,
      WelfareSupportStatus.APPROVED,
      WelfareSupportStatus.PAID,
      WelfareSupportStatus.CANCELLED,
    ])
    .optional(),
  memberId: z.string().optional(),
  supportYear: z.coerce.number().int().positive().optional(),
  supportMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type WelfareSupportListQuery = z.infer<typeof welfareSupportListQuerySchema>;

/** Alias for unified welfare + claim payment history queries */
export type WelfareHistoryListQuery = WelfareSupportListQuery;
