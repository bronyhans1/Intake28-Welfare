import { FieldValue } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sanitizeFirestoreData,
  warnInvalidFirestorePayload,
} from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { WelfareSupportTypeAuditAction } from "@/lib/welfare-support-types/audit";
import { DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS } from "@/lib/welfare-support-types/seed-data";
import type {
  CreateWelfareSupportTypeConfigInput,
  UpdateWelfareSupportTypeConfigInput,
  WelfareSupportTypeListQuery,
} from "@/lib/welfare-support-types/validation";
import type { CurrentUser } from "@/types/auth";
import type { UserRole } from "@/types/enums";
import type {
  SerializedWelfareSupportTypeConfig,
  WelfareSupportTypeConfig,
  WelfareSupportTypeOption,
} from "@/types/welfare-support-type";

function mapType(
  id: string,
  data: Record<string, unknown>,
): WelfareSupportTypeConfig {
  return { id, ...data } as WelfareSupportTypeConfig;
}

function serializeType(
  record: WelfareSupportTypeConfig,
): SerializedWelfareSupportTypeConfig {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedWelfareSupportTypeConfig>(
    id,
    rest as Record<string, unknown>,
  );
}

function toOption(record: WelfareSupportTypeConfig): WelfareSupportTypeOption {
  return {
    code: record.code,
    displayName: record.displayName,
    active: record.active,
    sortOrder: record.sortOrder,
  };
}

export function canManageWelfareSupportTypes(role: UserRole): boolean {
  return hasPermission(role, Permission.MANAGE_WELFARE_SUPPORT_TYPES);
}

export function canViewWelfareSupportTypeCatalog(role: UserRole): boolean {
  return (
    hasPermission(role, Permission.MANAGE_WELFARE_SUPPORT_TYPES) ||
    hasPermission(role, Permission.CREATE_WELFARE_SUPPORT) ||
    hasPermission(role, Permission.VIEW_WELFARE_SUPPORT)
  );
}

export interface WelfareSupportTypeListResult {
  types: SerializedWelfareSupportTypeConfig[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SeedWelfareSupportTypesResult {
  created: string[];
  skipped: string[];
}

async function fetchAllTypes(): Promise<WelfareSupportTypeConfig[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
    .get();
  const types = snapshot.docs.map((doc) =>
    mapType(doc.id, doc.data() as Record<string, unknown>),
  );
  return types.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

export async function getWelfareSupportTypeConfigById(
  typeId: string,
): Promise<SerializedWelfareSupportTypeConfig | null> {
  const db = getAdminDb();
  const doc = await db
    .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
    .doc(typeId)
    .get();
  if (!doc.exists) return null;
  return serializeType(mapType(doc.id, doc.data() as Record<string, unknown>));
}

export async function getWelfareSupportTypeConfigByCode(
  code: string,
): Promise<SerializedWelfareSupportTypeConfig | null> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
    .where("code", "==", code)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return serializeType(mapType(doc.id, doc.data() as Record<string, unknown>));
}

export async function listWelfareSupportTypeConfigs(
  query: WelfareSupportTypeListQuery,
): Promise<WelfareSupportTypeListResult> {
  let types = await fetchAllTypes();

  if (typeof query.active === "boolean") {
    types = types.filter((type) => type.active === query.active);
  }

  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase();
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

/** Active types for new Welfare Support recording (sorted). */
export async function listActiveWelfareSupportTypes(): Promise<
  WelfareSupportTypeOption[]
> {
  const types = await fetchAllTypes();
  return types.filter((type) => type.active).map(toOption);
}

/** All catalog types for filters/labels (includes inactive). */
export async function listAllWelfareSupportTypeOptions(): Promise<
  WelfareSupportTypeOption[]
> {
  const types = await fetchAllTypes();
  return types.map(toOption);
}

/**
 * Options for edit forms: all active types, plus the record's current code
 * even when that type is inactive or missing from the catalog.
 */
export async function listWelfareSupportTypeOptionsForEdit(
  currentCode: string,
): Promise<WelfareSupportTypeOption[]> {
  const all = await fetchAllTypes();
  const options = all.filter((type) => type.active).map(toOption);
  const trimmed = currentCode.trim();
  if (!trimmed) return options;

  if (!options.some((type) => type.code === trimmed)) {
    const existing = all.find((type) => type.code === trimmed);
    if (existing) {
      options.push(toOption(existing));
    } else {
      options.push({
        code: trimmed,
        displayName: trimmed,
        active: false,
        sortOrder: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return options.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
  );
}

export async function createWelfareSupportTypeConfig(
  input: CreateWelfareSupportTypeConfigInput,
  actor: CurrentUser,
): Promise<{ typeId: string }> {
  const existing = await getWelfareSupportTypeConfigByCode(input.code);
  if (existing) {
    throw new Error("A welfare support type with this code already exists.");
  }

  const db = getAdminDb();
  const ref = db
    .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
    .doc(input.code);

  const payload = sanitizeFirestoreData({
    code: input.code,
    displayName: input.displayName.trim(),
    description: input.description.trim(),
    active: input.active,
    sortOrder: input.sortOrder,
    createdById: actor.uid,
    createdByName: actor.fullName,
    updatedById: actor.uid,
    updatedByName: actor.fullName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createWelfareSupportTypeConfig", payload);
  await ref.set(payload);

  await createAuditLog({
    action: WelfareSupportTypeAuditAction.WELFARE_SUPPORT_TYPE_CREATED,
    entityType: "welfare_support_type_config",
    entityId: ref.id,
    ...buildAuditActor(actor),
    metadata: { code: input.code, displayName: input.displayName },
  });

  return { typeId: ref.id };
}

export async function updateWelfareSupportTypeConfig(
  typeId: string,
  input: UpdateWelfareSupportTypeConfigInput,
  actor: CurrentUser,
): Promise<void> {
  const existing = await getWelfareSupportTypeConfigById(typeId);
  if (!existing) {
    throw new Error("Welfare support type not found.");
  }

  const db = getAdminDb();
  const payload = sanitizeFirestoreData({
    displayName: input.displayName.trim(),
    description: input.description.trim(),
    active: input.active,
    sortOrder: input.sortOrder,
    updatedById: actor.uid,
    updatedByName: actor.fullName,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateWelfareSupportTypeConfig", payload);
  await db
    .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
    .doc(typeId)
    .update(payload);

  await createAuditLog({
    action: WelfareSupportTypeAuditAction.WELFARE_SUPPORT_TYPE_UPDATED,
    entityType: "welfare_support_type_config",
    entityId: typeId,
    ...buildAuditActor(actor),
    changes: {
      displayName: {
        before: existing.displayName,
        after: input.displayName.trim(),
      },
      active: { before: existing.active, after: input.active },
      sortOrder: { before: existing.sortOrder, after: input.sortOrder },
    },
    metadata: { code: existing.code },
  });
}

/**
 * Idempotent seed of the eight legacy welfare support types.
 * Existing codes are never overwritten.
 */
export async function seedDefaultWelfareSupportTypes(
  actor: CurrentUser,
): Promise<SeedWelfareSupportTypesResult> {
  const created: string[] = [];
  const skipped: string[] = [];
  const db = getAdminDb();

  for (const seed of DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS) {
    const ref = db
      .collection(COLLECTIONS.WELFARE_SUPPORT_TYPE_CONFIGS)
      .doc(seed.code);
    const existing = await ref.get();
    if (existing.exists) {
      skipped.push(seed.code);
      continue;
    }

    const payload = sanitizeFirestoreData({
      code: seed.code,
      displayName: seed.displayName,
      description: "",
      active: true,
      sortOrder: seed.sortOrder,
      createdById: actor.uid,
      createdByName: actor.fullName,
      updatedById: actor.uid,
      updatedByName: actor.fullName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    warnInvalidFirestorePayload("seedDefaultWelfareSupportTypes", payload);
    await ref.set(payload);
    created.push(seed.code);
  }

  if (created.length > 0) {
    await createAuditLog({
      action: WelfareSupportTypeAuditAction.WELFARE_SUPPORT_TYPE_SEEDED,
      entityType: "welfare_support_type_config",
      entityId: "seed",
      ...buildAuditActor(actor),
      metadata: { created, skipped },
    });
  }

  return { created, skipped };
}

/**
 * Assert a support type code may be used when creating a welfare support record.
 */
export async function assertSupportTypeAllowedForCreate(
  code: string,
): Promise<void> {
  const config = await getWelfareSupportTypeConfigByCode(code);
  if (!config) {
    throw new Error("Select a valid support type.");
  }
  if (!config.active) {
    throw new Error("This support type is inactive and cannot be selected.");
  }
}

/**
 * Assert a support type may be used when updating a record.
 * Inactive types remain valid only when preserving the existing code.
 */
export async function assertSupportTypeAllowedForUpdate(
  code: string,
  existingCode: string,
): Promise<void> {
  if (code === existingCode) return;

  const config = await getWelfareSupportTypeConfigByCode(code);
  if (!config) {
    throw new Error("Select a valid support type.");
  }
  if (!config.active) {
    throw new Error("This support type is inactive and cannot be selected.");
  }
}
