import { z } from "zod";
import {
  PaymentCategory,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@/types/enums";

const memberIdSchema = z.string().min(1);

const amountSchema = z.coerce
  .number({ error: "Amount must be at least 1" })
  .min(1, "Amount must be at least 1");

const contributionMonthSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
});

export const initializePaymentSchema = z.discriminatedUnion("paymentType", [
  z.object({
    memberId: memberIdSchema,
    paymentType: z.literal(PaymentType.MONTHLY_DUES),
    amount: amountSchema.optional(),
    selectedMonths: z
      .array(contributionMonthSchema)
      .min(1, "Select at least one contribution month."),
  }),
  z.object({
    memberId: memberIdSchema,
    paymentType: z.literal(PaymentType.SPECIAL_CONTRIBUTION),
    amount: amountSchema,
  }),
  z.object({
    memberId: memberIdSchema,
    paymentType: z.literal(PaymentType.OTHER),
    amount: amountSchema,
  }),
]);

export const verifyPaymentSchema = z.object({
  reference: z.string().trim().min(1, "Payment reference is required"),
});

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  paymentType: z.string().trim().optional(),
  paymentCategory: z
    .enum([
      PaymentCategory.CONTRIBUTION,
      PaymentCategory.CLAIM,
      PaymentCategory.SPECIAL_CONTRIBUTION,
    ])
    .optional(),
  paymentMethod: z
    .enum([
      PaymentMethod.MOBILE_MONEY,
      PaymentMethod.BANK_CARD,
      PaymentMethod.BANK_TRANSFER,
      PaymentMethod.CASH,
      PaymentMethod.CHEQUE,
      PaymentMethod.OTHER,
    ])
    .optional(),
  memberId: z.string().trim().optional(),
});

export type InitializePaymentPayload = z.infer<typeof initializePaymentSchema>;
export type VerifyPaymentPayload = z.infer<typeof verifyPaymentSchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export { PaymentStatus };
