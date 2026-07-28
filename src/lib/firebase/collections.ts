import { COLLECTIONS } from "@/lib/constants";

export const firestorePaths = {
  users: () => COLLECTIONS.USERS,
  user: (id: string) => `${COLLECTIONS.USERS}/${id}`,
  contributions: () => COLLECTIONS.CONTRIBUTIONS,
  contribution: (id: string) => `${COLLECTIONS.CONTRIBUTIONS}/${id}`,
  payments: () => COLLECTIONS.PAYMENTS,
  payment: (id: string) => `${COLLECTIONS.PAYMENTS}/${id}`,
  receipts: () => COLLECTIONS.RECEIPTS,
  receipt: (id: string) => `${COLLECTIONS.RECEIPTS}/${id}`,
  announcements: () => COLLECTIONS.ANNOUNCEMENTS,
  announcement: (id: string) => `${COLLECTIONS.ANNOUNCEMENTS}/${id}`,
  auditLogs: () => COLLECTIONS.AUDIT_LOGS,
  auditLog: (id: string) => `${COLLECTIONS.AUDIT_LOGS}/${id}`,
  systemSettings: () => `${COLLECTIONS.SYSTEM}/settings`,
} as const;
