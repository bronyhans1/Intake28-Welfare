import { z } from "zod";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { isValidServiceNumberSuffix } from "@/lib/utils/service-number";
import { MembershipRequestStatus } from "@/types/membership-request";

const ghanaPhoneSchema = z
  .string()
  .min(1, "Telephone number is required")
  .transform(normalizePhoneNumber)
  .pipe(
    z
      .string()
      .regex(/^0\d{9}$/, "Enter a valid Ghana phone number (e.g. 024XXXXXXX)"),
  );

export const submitMembershipRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  serviceNumberSuffix: z
    .string()
    .min(1, "Service number is required")
    .refine(isValidServiceNumberSuffix, {
      message: "Enter digits only (e.g. 13984)",
    }),
  phoneNumber: ghanaPhoneSchema,
});

export type SubmitMembershipRequestInput = z.infer<
  typeof submitMembershipRequestSchema
>;

export const membershipRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().optional(),
  status: z
    .enum([
      MembershipRequestStatus.PENDING,
      MembershipRequestStatus.APPROVED,
      MembershipRequestStatus.DECLINED,
    ])
    .optional(),
  sort: z.enum(["newest", "oldest", "name"]).default("newest"),
});

export type MembershipRequestListQuery = z.infer<
  typeof membershipRequestListQuerySchema
>;

export const approveMembershipRequestSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  remarks: z.string().trim().max(1000).optional(),
});

export type ApproveMembershipRequestInput = z.infer<
  typeof approveMembershipRequestSchema
>;

export const declineMembershipRequestSchema = z.object({
  requestId: z.string().trim().min(1, "Request id is required"),
  remarks: z
    .string()
    .trim()
    .min(1, "A reason is required when declining a request")
    .max(1000),
});

export type DeclineMembershipRequestInput = z.infer<
  typeof declineMembershipRequestSchema
>;
