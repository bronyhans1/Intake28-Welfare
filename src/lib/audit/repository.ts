import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { resolveAuditActorDisplayName } from "@/lib/audit/actor";
import {
  formatAuditActionLabel,
  formatAuditDescription,
  formatAuditEntityLabel,
} from "@/lib/audit/labels";
import {
  sanitizeAuditChanges,
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import type { AuditLogListQuery } from "@/lib/validators/audit-log";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { AuditLog } from "@/types/audit-log";
import type { UserRole } from "@/types/enums";

export type CreateAuditLogInput = Omit<AuditLog, "id" | "createdAt">;

export type SerializedAuditLog = Omit<AuditLog, "createdAt"> & {
  createdAt: string;
  label: string;
  entityLabel: string;
  description: string;
  actorDisplayName: string;
};

export interface AuditLogListResult {
  logs: SerializedAuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function createAuditLog(input: CreateAuditLogInput): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.AUDIT_LOGS).doc();

  const payload = sanitizeFirestoreData({
    ...input,
    changes: input.changes ? sanitizeAuditChanges(input.changes) : undefined,
    metadata: input.metadata
      ? sanitizeFirestoreData(input.metadata as Record<string, unknown>)
      : undefined,
  });

  warnInvalidFirestorePayload("createAuditLog", payload);

  await ref.set({
    ...payload,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}

function mapAuditLog(id: string, data: Record<string, unknown>): AuditLog {
  return { id, ...data } as AuditLog;
}

function parseDateBoundary(value: string | undefined, endOfDay = false): number | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed.getTime();
}

async function serializeAuditLog(
  log: AuditLog,
  options: { sessionUserFullName?: string | null } = {},
): Promise<SerializedAuditLog> {
  const { id, createdAt, ...rest } = log;
  const serialized = serializeFirestoreDoc<Record<string, unknown>>(
    id,
    rest as Record<string, unknown>,
  );

  const action = String(serialized.action ?? "");
  const metadata =
    serialized.metadata && typeof serialized.metadata === "object"
      ? (serialized.metadata as Record<string, unknown>)
      : undefined;
  const changes =
    serialized.changes && typeof serialized.changes === "object"
      ? (serialized.changes as Record<string, { before: unknown; after: unknown }>)
      : undefined;

  const actorDisplayName = await resolveAuditActorDisplayName(
    {
      actorName:
        typeof serialized.actorName === "string" ? serialized.actorName : undefined,
      actorId:
        typeof serialized.actorId === "string" ? serialized.actorId : undefined,
      performedBy:
        typeof serialized.performedBy === "string" ? serialized.performedBy : undefined,
    },
    { sessionUserFullName: options.sessionUserFullName },
  );

  return {
    id,
    action,
    entityType: String(serialized.entityType ?? ""),
    entityId: String(serialized.entityId ?? ""),
    performedBy: String(serialized.performedBy ?? ""),
    performedByRole: String(serialized.performedByRole ?? ""),
    actorId: typeof serialized.actorId === "string" ? serialized.actorId : undefined,
    actorName: typeof serialized.actorName === "string" ? serialized.actorName : undefined,
    role: typeof serialized.role === "string" ? serialized.role : undefined,
    changes,
    metadata,
    createdAt: String(serialized.createdAt ?? ""),
    label: formatAuditActionLabel(action),
    entityLabel: formatAuditEntityLabel(
      String(serialized.entityType ?? ""),
      String(serialized.entityId ?? ""),
      metadata,
    ),
    description: formatAuditDescription(action, metadata, changes),
    actorDisplayName,
  };
}

export async function listAuditLogs(
  query: AuditLogListQuery,
  options: { sessionUserFullName?: string | null } = {},
): Promise<AuditLogListResult> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .orderBy("createdAt", "desc")
    .get();

  const dateFromMs = parseDateBoundary(query.dateFrom);
  const dateToMs = parseDateBoundary(query.dateTo, true);
  const search = query.search?.trim().toLowerCase();
  const actorSearch = query.actor?.trim().toLowerCase();

  const filtered = snapshot.docs.filter((doc) => {
    const data = doc.data();
    const action = String(data.action ?? "");

    if (query.action && action !== query.action) return false;

    const createdAt = data.createdAt;
    let createdAtMs: number | null = null;
    if (createdAt && typeof createdAt === "object" && "toDate" in createdAt) {
      createdAtMs = (createdAt as { toDate: () => Date }).toDate().getTime();
    }

    if (dateFromMs != null && createdAtMs != null && createdAtMs < dateFromMs) {
      return false;
    }
    if (dateToMs != null && createdAtMs != null && createdAtMs > dateToMs) {
      return false;
    }

    const actorName = String(data.actorName ?? "").toLowerCase();
    const actorId = String(data.actorId ?? data.performedBy ?? "").toLowerCase();

    if (actorSearch) {
      if (!actorName.includes(actorSearch) && !actorId.includes(actorSearch)) {
        return false;
      }
    }

    if (search) {
      const entityId = String(data.entityId ?? "").toLowerCase();
      const metadata = (data.metadata as Record<string, unknown> | undefined) ?? {};
      const serviceNumber = String(metadata.serviceNumber ?? "").toLowerCase();
      const memberName = String(metadata.memberName ?? "").toLowerCase();
      const fullName = String(metadata.fullName ?? "").toLowerCase();
      const entityLabel = formatAuditEntityLabel(
        String(data.entityType ?? ""),
        String(data.entityId ?? ""),
        metadata,
      ).toLowerCase();

      const matches =
        action.toLowerCase().includes(search) ||
        actorName.includes(search) ||
        entityLabel.includes(search) ||
        serviceNumber.includes(search) ||
        memberName.includes(search) ||
        fullName.includes(search) ||
        String(metadata.displayName ?? "").toLowerCase().includes(search) ||
        String(metadata.code ?? "").toLowerCase().includes(search) ||
        String(metadata.claimNumber ?? "").toLowerCase().includes(search) ||
        String(metadata.reference ?? "").toLowerCase().includes(search) ||
        entityId.includes(search);

      if (!matches) return false;
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  const pageDocs = filtered.slice(start, start + query.pageSize);
  const logs = await Promise.all(
    pageDocs.map(async (doc) =>
      serializeAuditLog(
        mapAuditLog(doc.id, doc.data() as Record<string, unknown>),
        options,
      ),
    ),
  );

  return { logs, total, page, pageSize: query.pageSize, totalPages };
}

export function canViewAuditLogs(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_AUDIT_LOGS);
}
