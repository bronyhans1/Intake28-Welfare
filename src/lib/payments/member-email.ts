import { z } from "zod";
import { env } from "@/config/env";
import {
  PAYMENT_EMAIL_DOMAIN_FALLBACK,
  PAYSTACK_BLOCKED_EMAIL_TLDS,
} from "@/lib/constants/payments";
import { getAuthEmailFromServiceNumber } from "@/lib/auth/auth-email";
import { normalizeMemberEmail } from "@/lib/members/email";
import type { SerializedMember } from "@/types/user";

const emailSchema = z.string().email();

export function getPaymentEmailDomain(): string {
  const configured = env.server().PAYMENT_EMAIL_DOMAIN;
  if (configured) {
    return configured;
  }

  try {
    const hostname = new URL(env.client().NEXT_PUBLIC_APP_URL).hostname;
    if (hostname && !["localhost", "127.0.0.1"].includes(hostname)) {
      return hostname;
    }
  } catch {
    // fall through to dev fallback
  }

  return PAYMENT_EMAIL_DOMAIN_FALLBACK;
}

export function deriveMemberPaymentEmail(
  member: Pick<SerializedMember, "serviceNumber">,
): string {
  const localPart = getAuthEmailFromServiceNumber(member.serviceNumber).split("@")[0]!;
  return `${localPart}@${getPaymentEmailDomain()}`;
}

export function deriveMemberPaymentEmailAddress(
  member: Pick<SerializedMember, "serviceNumber" | "email">,
): string {
  const memberEmail = normalizeMemberEmail(member.email);
  if (memberEmail && emailSchema.safeParse(memberEmail).success) {
    return memberEmail;
  }

  return deriveMemberPaymentEmail(member);
}

export function isPaystackCompatibleEmail(email: string): boolean {
  if (!emailSchema.safeParse(email).success) {
    return false;
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return false;
  }

  return !PAYSTACK_BLOCKED_EMAIL_TLDS.some((suffix) => domain.endsWith(suffix));
}
