import type { User } from "@/types/user";
import { normalizeMemberEmail } from "@/lib/members/email";

export { DUPLICATE_EMAIL_ERROR } from "@/lib/members/email";

export const DUPLICATE_SERVICE_NUMBER_ERROR =
  "A member with this service number already exists." as const;

export const DUPLICATE_PHONE_NUMBER_ERROR =
  "A member with this phone number already exists." as const;

export function findDuplicateServiceNumber(
  users: User[],
  serviceNumber: string,
  serviceNumberSuffix: string,
  excludeUserId?: string,
): User | null {
  return (
    users.find((user) => {
      if (excludeUserId && user.id === excludeUserId) return false;
      return (
        user.serviceNumber === serviceNumber ||
        user.serviceNumberSuffix === serviceNumberSuffix
      );
    }) ?? null
  );
}

export function findDuplicatePhoneNumber(
  users: User[],
  phoneNumber: string,
  excludeUserId?: string,
): User | null {
  const normalized = phoneNumber.trim();
  return (
    users.find((user) => {
      if (excludeUserId && user.id === excludeUserId) return false;
      return user.phoneNumber === normalized;
    }) ?? null
  );
}

export function findDuplicateEmail(
  users: User[],
  email: string | null | undefined,
  excludeUserId?: string,
): User | null {
  const normalized = normalizeMemberEmail(email);
  if (!normalized) {
    return null;
  }

  return (
    users.find((user) => {
      if (excludeUserId && user.id === excludeUserId) return false;
      return normalizeMemberEmail(user.email) === normalized;
    }) ?? null
  );
}

export function matchesMemberSearch(user: User, search: string): boolean {
  const term = search.trim().toLowerCase();
  if (!term) return true;

  const email = normalizeMemberEmail(user.email);

  return (
    user.fullName.toLowerCase().includes(term) ||
    user.serviceNumber.toLowerCase().includes(term) ||
    user.serviceNumberSuffix.toLowerCase().includes(term) ||
    user.phoneNumber.toLowerCase().includes(term) ||
    (email ? email.includes(term) : false)
  );
}
