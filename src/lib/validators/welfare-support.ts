import { z } from "zod";
import { WelfareSupportStatus, WelfareSupportType } from "@/types/enums";

const WELFARE_SUPPORT_TYPES = [
  WelfareSupportType.FUNERAL,
  WelfareSupportType.WEDDING,
  WelfareSupportType.NAMING,
  WelfareSupportType.MEDICAL,
  WelfareSupportType.EDUCATION,
  WelfareSupportType.EMERGENCY,
  WelfareSupportType.BEREAVEMENT,
  WelfareSupportType.OTHER,
] as const;

export const createWelfareSupportSchema = z.object({
  memberId: z.string().min(1, "Member is required"),
  memberName: z.string().min(1, "Member name is required"),
  serviceNumber: z.string().min(1, "Service number is required"),
  supportType: z.enum(WELFARE_SUPPORT_TYPES, {
    message: "Select a valid support type",
  }),
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  description: z.string().min(1, "Description is required"),
});

export type CreateWelfareSupportInput = z.infer<typeof createWelfareSupportSchema>;

export const updateWelfareSupportSchema = z.object({
  supportType: z.enum(WELFARE_SUPPORT_TYPES, {
    message: "Select a valid support type",
  }),
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .finite("Amount must be a finite number"),
  description: z.string().min(1, "Description is required"),
});

export type UpdateWelfareSupportInput = z.infer<typeof updateWelfareSupportSchema>;

export const welfareSupportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional(),
  supportType: z.enum(WELFARE_SUPPORT_TYPES).optional(),
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
