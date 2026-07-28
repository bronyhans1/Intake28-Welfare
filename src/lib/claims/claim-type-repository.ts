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
import type {
  ClaimTypeListQuery,
  CreateClaimTypeConfigInput,
  UpdateClaimTypeConfigInput,
} from "@/lib/validators/claims";
import type { CurrentUser } from "@/types/auth";
import type {
  ClaimTypeConfig,
  SerializedClaimTypeConfig,
} from "@/types/claims";
import type { UserRole } from "@/types/enums";
import { DuplicateRuleMode } from "@/types/enums";

function mapType(id: string, data: Record<string, unknown>): ClaimTypeConfig {
  return { id, ...data } as ClaimTypeConfig;
}

function serializeType(record: ClaimTypeConfig): SerializedClaimTypeConfig {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedClaimTypeConfig>(
    id,
    rest as Record<string, unknown>,
  );
}

function nextConfigVersion(): string {
  return new Date().toISOString();
}

export function canManageClaimTypes(role: UserRole): boolean {
  return hasPermission(role, Permission.MANAGE_CLAIM_TYPES);
}

export function canViewClaimTypes(role: UserRole): boolean {
  return (
    hasPermission(role, Permission.MANAGE_CLAIM_TYPES) ||
    hasPermission(role, Permission.CREATE_CLAIM) ||
    hasPermission(role, Permission.VIEW_ALL_CLAIMS)
  );
}

export interface ClaimTypeListResult {
  types: SerializedClaimTypeConfig[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchAllTypes(): Promise<ClaimTypeConfig[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(COLLECTIONS.CLAIM_TYPE_CONFIGS).get();
  const types = snapshot.docs.map((doc) =>
    mapType(doc.id, doc.data() as Record<string, unknown>),
  );
  return types.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
}

export async function getClaimTypeConfigById(
  typeId: string,
): Promise<SerializedClaimTypeConfig | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.CLAIM_TYPE_CONFIGS).doc(typeId).get();
  if (!doc.exists) return null;
  return serializeType(mapType(doc.id, doc.data() as Record<string, unknown>));
}

export async function getClaimTypeConfigByCode(
  code: string,
): Promise<SerializedClaimTypeConfig | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.CLAIM_TYPE_CONFIGS)
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return serializeType(mapType(doc.id, doc.data() as Record<string, unknown>));
}

export async function listClaimTypeConfigs(
  query: ClaimTypeListQuery,
): Promise<ClaimTypeListResult> {
  let types = await fetchAllTypes();

  if (typeof query.active === "boolean") {
    types = types.filter((type) => type.active === query.active);
  }

  if (query.search) {
    const search = query.search.toLowerCase();
    types = types.filter(
      (type) =>
        type.code.toLowerCase().includes(search) ||
        type.displayName.toLowerCase().includes(search) ||
        type.description.toLowerCase().includes(search),
    );
  }

  const total = types.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const pageTypes = types.slice(start, start + query.pageSize).map(serializeType);

  return {
    types: pageTypes,
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

/** Active types for member draft creation */
export async function listActiveClaimTypesForMembers(): Promise<
  SerializedClaimTypeConfig[]
> {
  const types = await fetchAllTypes();
  return types
    .filter((type) => type.active && type.allowDrafts)
    .map(serializeType);
}

export async function createClaimTypeConfig(
  input: CreateClaimTypeConfigInput,
  actor: CurrentUser,
): Promise<{ typeId: string }> {
  const existing = await getClaimTypeConfigByCode(input.code);
  if (existing) {
    throw new Error("A claim type with this code already exists.");
  }

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.CLAIM_TYPE_CONFIGS).doc(input.code);

  const payload = sanitizeFirestoreData({
    code: input.code,
    displayName: input.displayName.trim(),
    description: input.description.trim(),
    active: input.active,
    requiresExecutiveApproval: input.requiresExecutiveApproval,
    requiresTreasurerPayment: input.requiresTreasurerPayment,
    amountMode: input.amountMode,
    fixedAmount: input.fixedAmount ?? null,
    formulaKey: input.formulaKey ?? null,
    waitingPeriodDays: input.waitingPeriodDays,
    benefitPercentage: input.benefitPercentage,
    allowDrafts: input.allowDrafts,
    maxDocuments: input.maxDocuments,
    requiredDocuments: input.requiredDocuments,
    eligibilityChecks: input.eligibilityChecks,
    checklist: input.checklist,
    notifications: input.notifications ?? {},
    allowMultipleOpenClaims: input.allowMultipleOpenClaims,
    duplicateRules: input.duplicateRules ?? {
      mode: DuplicateRuleMode.NONE,
      scope: "member_and_type",
    },
    sortOrder: input.sortOrder,
    configVersion: nextConfigVersion(),
    createdBy: actor.uid,
    createdByName: actor.fullName,
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createClaimTypeConfig", payload);
  await ref.set(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_TYPE_CREATED,
    entityType: "claim_type_config",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: { code: input.code, displayName: input.displayName },
  });

  return { typeId: ref.id };
}

export async function updateClaimTypeConfig(
  typeId: string,
  input: UpdateClaimTypeConfigInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getClaimTypeConfigById(typeId);
  if (!existing) {
    throw new Error("Claim type not found.");
  }

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    displayName: input.displayName.trim(),
    description: input.description.trim(),
    active: input.active,
    requiresExecutiveApproval: input.requiresExecutiveApproval,
    requiresTreasurerPayment: input.requiresTreasurerPayment,
    amountMode: input.amountMode,
    fixedAmount: input.fixedAmount ?? null,
    formulaKey: input.formulaKey ?? null,
    waitingPeriodDays: input.waitingPeriodDays,
    benefitPercentage: input.benefitPercentage,
    allowDrafts: input.allowDrafts,
    maxDocuments: input.maxDocuments,
    requiredDocuments: input.requiredDocuments,
    eligibilityChecks: input.eligibilityChecks,
    checklist: input.checklist,
    notifications: input.notifications ?? {},
    allowMultipleOpenClaims: input.allowMultipleOpenClaims,
    duplicateRules: input.duplicateRules,
    sortOrder: input.sortOrder,
    configVersion: nextConfigVersion(),
    updatedBy: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateClaimTypeConfig", payload);
  await db.collection(COLLECTIONS.CLAIM_TYPE_CONFIGS).doc(typeId).update(payload);

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_TYPE_UPDATED,
    entityType: "claim_type_config",
    entityId: typeId,
    ...buildAuditActor(actor),
    changes: {
      displayName: {
        before: existing.displayName,
        after: input.displayName.trim(),
      },
      active: { before: existing.active, after: input.active },
    },
    metadata: { code: existing.code },
  });
}

export async function deleteClaimTypeConfig(
  typeId: string,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getClaimTypeConfigById(typeId);
  if (!existing) {
    throw new Error("Claim type not found.");
  }

  const db = getAdminDb();
  const drafts = await db
    .collection(COLLECTIONS.CLAIMS)
    .where("claimTypeCode", "==", existing.code)
    .where("status", "==", "draft")
    .limit(1)
    .get();

  if (!drafts.empty) {
    throw new Error(
      "Cannot delete a claim type that still has draft claims. Deactivate it instead.",
    );
  }

  await db.collection(COLLECTIONS.CLAIM_TYPE_CONFIGS).doc(typeId).delete();

  await createAuditLog({
    action: ClaimsAuditAction.CLAIM_TYPE_DELETED,
    entityType: "claim_type_config",
    entityId: typeId,
    ...buildAuditActor(actor),
    metadata: { code: existing.code, displayName: existing.displayName },
  });
}
