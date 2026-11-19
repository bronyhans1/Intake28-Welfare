import { z } from "zod";

const emailSchema = z.string().email();

export const DUPLICATE_EMAIL_ERROR =
  "A member with this email address already exists." as const;

export function normalizeMemberEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

export function isValidMemberEmail(value: string): boolean {
  return emailSchema.safeParse(value.trim().toLowerCase()).success;
}

export function resolveMemberEmailInput(value: string | undefined): string | null {
  const normalized = normalizeMemberEmail(value ?? "");
  if (!normalized) {
    return null;
  }

  if (!isValidMemberEmail(normalized)) {
    throw new Error("Enter a valid email address.");
  }

  return normalized;
}
