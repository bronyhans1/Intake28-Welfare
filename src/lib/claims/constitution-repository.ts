import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  nextConstitutionVersionId,
  rulesetVersionFromConstitutionId,
} from "@/lib/utils/internal-id";
import type {
  ConstitutionListQuery,
  CreateConstitutionDraftInput,
  UpdateConstitutionDraftInput,
} from "@/lib/validators/claims";
import { ConstitutionStatus } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type {
  ConstitutionVersion,
  SerializedConstitutionVersion,
} from "@/types/claims";
import type { UserRole } from "@/types/enums";

function mapConstitution(
  id: string,
  data: Record<string, unknown>,
): ConstitutionVersion {
  return { id, ...data } as ConstitutionVersion;
}

function serializeConstitution(
  record: ConstitutionVersion,
): SerializedConstitutionVersion {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedConstitutionVersion>(
    id,
    rest as Record<string, unknown>,
  );
}

export function canManageConstitutions(role: UserRole): boolean {
  return hasPermission(role, Permission.MANAGE_CONSTITUTIONS);
}

export function canViewConstitutions(role: UserRole): boolean {
  return (
    hasPermission(role, Permission.MANAGE_CONSTITUTIONS) ||
    hasPermission(role, Permission.VIEW_CONSTITUTIONS)
  );
}

export interface ConstitutionListResult {
  versions: SerializedConstitutionVersion[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchAllConstitutions(): Promise<ConstitutionVersion[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.CONSTITUTIONS).get();
  const versions = snapshot.docs.map((doc) =>
    mapConstitution(doc.id, doc.data() as Record<string, unknown>),
  );
  return versions.sort((a, b) =>
    b.versionNumber.localeCompare(a.versionNumber),
  );
}

export async function getConstitutionById(
  versionId: string,
): Promise<SerializedConstitutionVersion | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CONSTITUTIONS).doc(versionId).get();
  if (!doc.exists) return null;
  return serializeConstitution(
    mapConstitution(doc.id, doc.data() as Record<string, unknown>),
  );
}

/**
 * Returns the currently Active constitution, if any.
 * Used by the Eligibility Engine for reference only (does not activate/retire).
 */
export async function getActiveConstitution(): Promise<SerializedConstitutionVersion | null> {
  const versions = await fetchAllConstitutions();
  const active = versions.find(
    (version) => version.status === ConstitutionStatus.ACTIVE,
  );
  return active ? serializeConstitution(active) : null;
}

export async function allocateNextConstitutionId(): Promise<string> {
  const versions = await fetchAllConstitutions();
  return nextConstitutionVersionId(versions.map((version) => version.id));
}

async function retireActiveConstitutions(
  exceptId: string,
  actor: CurrentUser,
): Promise<void> {
  const db = getAdminDb();
  const versions = await fetchAllConstitutions();
  const active = versions.filter(
    (version) =>
      version.status === ConstitutionStatus.ACTIVE && version.id !== exceptId,
  );

  for (const version of active) {
    await db.collection(COLLECTIONS.CONSTITUTIONS).doc(version.id).update(
      sanitizeFirestoreData({
        status: ConstitutionStatus.RETIRED,
        retiredAt: FieldValue.serverTimestamp(),
        supersededById: exceptId,
        updatedBy: actor.uid,
        updatedByName: actor.fullName,
        updatedAt: FieldValue.serverTimestamp(),
      }),
    );
  }
}

export async function listConstitutionDrafts(
  query: ConstitutionListQuery,
): Promise<ConstitutionListResult> {
  let versions = await fetchAllConstitutions();

  versions = versions.filter(
    (version) => version.status === ConstitutionStatus.DRAFT,
  );

  if (query.search) {
    const search = query.search.toLowerCase();
    versions = versions.filter(
      (version) =>
        version.id.toLowerCase().includes(search) ||
        version.displayName.toLowerCase().includes(search) ||
        version.versionNumber.toLowerCase().includes(search),
    );
  }

  const total = versions.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const pageVersions = versions
    .slice(start, start + query.pageSize)
    .map(serializeConstitution);

  return {
    versions: pageVersions,
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function listAllConstitutions(
  query: ConstitutionListQuery,
): Promise<ConstitutionListResult> {
  let versions = await fetchAllConstitutions();

  if (query.search) {
    const search = query.search.toLowerCase();
    versions = versions.filter(
      (version) =>
        version.id.toLowerCase().includes(search) ||
        version.displayName.toLowerCase().includes(search) ||
        version.versionNumber.toLowerCase().includes(search),
    );
  }

  const total = versions.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    versions: versions
      .slice(start, start + query.pageSize)
      .map(serializeConstitution),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function createConstitutionDraft(
  input: CreateConstitutionDraftInput,
  actor: CurrentUser,
): Promise<{ versionId: string }> {
  const versionId = input.id?.trim() || (await allocateNextConstitutionId());
  const existing = await getConstitutionById(versionId);
  if (existing) {
    throw new Error("A constitution version with this ID already exists.");
  }

  const rulesetVersion =
    input.rulesetVersion?.trim() ||
    rulesetVersionFromConstitutionId(versionId);

  const shouldPublish =
    Boolean(input.publishAsActive) && Boolean(input.documentRef?.trim());

  if (shouldPublish) {
    await retireActiveConstitutions(versionId, actor);
  }

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.CONSTITUTIONS).doc(versionId);

  const payload = sanitizeFirestoreData({
    displayName: input.displayName.trim(),
    versionNumber: input.versionNumber.trim(),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    status: shouldPublish
      ? ConstitutionStatus.ACTIVE
      : ConstitutionStatus.DRAFT,
    description: input.description.trim(),
    notes: input.notes ?? null,
    rulesetVersion,
    documentRef: input.documentRef ?? null,
    supersedesId: input.supersedesId ?? null,
    supersededById: null,
    approvedById: shouldPublish ? actor.uid : null,
    approvedByName: shouldPublish ? actor.fullName : null,
    approvalDate: shouldPublish
      ? new Date().toISOString().slice(0, 10)
      : null,
    amendmentReason: null,
    createdBy: actor.uid,
    createdByName: actor.fullName,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    activatedAt: shouldPublish ? FieldValue.serverTimestamp() : null,
    retiredAt: null,
  });

  warnInvalidFirestorePayload("createConstitutionDraft", payload);
  await ref.set(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CONSTITUTION_CREATED,
    entityType: "constitution",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: {
      versionNumber: input.versionNumber,
      displayName: input.displayName,
      status: shouldPublish
        ? ConstitutionStatus.ACTIVE
        : ConstitutionStatus.DRAFT,
      published: shouldPublish,
    },
  });

  return { versionId: ref.id };
}

export async function updateConstitutionDraft(
  versionId: string,
  input: UpdateConstitutionDraftInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getConstitutionById(versionId);
  if (!existing) {
    throw new Error("Constitution version not found.");
  }
  if (
    existing.status !== ConstitutionStatus.DRAFT &&
    existing.status !== ConstitutionStatus.ACTIVE
  ) {
    throw new Error("Retired constitutions cannot be edited.");
  }

  const rulesetVersion =
    input.rulesetVersion?.trim() ||
    existing.rulesetVersion ||
    rulesetVersionFromConstitutionId(versionId);

  const shouldPublish =
    Boolean(input.publishAsActive) &&
    Boolean((input.documentRef ?? existing.documentRef)?.trim()) &&
    existing.status === ConstitutionStatus.DRAFT;

  if (shouldPublish) {
    await retireActiveConstitutions(versionId, actor);
  }

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    displayName: input.displayName.trim(),
    versionNumber: input.versionNumber.trim(),
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    description: input.description.trim(),
    notes: input.notes ?? null,
    rulesetVersion,
    documentRef: input.documentRef ?? null,
    supersedesId: input.supersedesId ?? null,
    ...(shouldPublish
      ? {
          status: ConstitutionStatus.ACTIVE,
          activatedAt: FieldValue.serverTimestamp(),
          approvedById: actor.uid,
          approvedByName: actor.fullName,
          approvalDate: new Date().toISOString().slice(0, 10),
        }
      : {}),
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateConstitutionDraft", payload);
  await db.collection(COLLECTIONS.CONSTITUTIONS).doc(versionId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CONSTITUTION_UPDATED,
    entityType: "constitution",
    entityId: versionId,
    ...buildAuditActor(actor),
    changes: {
      displayName: {
        before: existing.displayName,
        after: input.displayName.trim(),
      },
      versionNumber: {
        before: existing.versionNumber,
        after: input.versionNumber.trim(),
      },
    },
    metadata: {
      status: shouldPublish ? ConstitutionStatus.ACTIVE : existing.status,
      published: shouldPublish,
    },
  });
}

export async function deleteConstitutionDraft(
  versionId: string,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getConstitutionById(versionId);
  if (!existing) {
    throw new Error("Constitution version not found.");
  }
  if (existing.status !== ConstitutionStatus.DRAFT) {
    throw new Error("Only draft constitutions can be deleted.");
  }

  const db = getAdminDb();
  await db.collection(COLLECTIONS.CONSTITUTIONS).doc(versionId).delete();

  await createAuditLog({
    action: ClaimsAuditAction.CONSTITUTION_DELETED,
    entityType: "constitution",
    entityId: versionId,
    ...buildAuditActor(actor),
    metadata: {
      versionNumber: existing.versionNumber,
      displayName: existing.displayName,
    },
  });
}
