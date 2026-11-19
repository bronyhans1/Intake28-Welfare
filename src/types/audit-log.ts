import type { Timestamp } from "firebase/firestore";
import type { AuditAction, UserRole } from "./enums";

export interface AuditLogChange {
  before: unknown;
  after: unknown;
}

export interface AuditLog {
  id: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  /** @deprecated Use actorId — kept for backward compatibility */
  performedBy: string;
  /** @deprecated Use role — kept for backward compatibility */
  performedByRole: UserRole | string;
  actorId?: string;
  actorName?: string;
  role?: UserRole | string;
  changes?: Record<string, AuditLogChange>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Timestamp;
}
