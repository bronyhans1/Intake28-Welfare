import { FieldValue } from "firebase-admin/firestore";
import { buildAuditActor } from "@/lib/audit/actor";
import { createAuditLog } from "@/lib/audit/repository";
import { firestorePaths } from "@/lib/firebase/collections";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreFields } from "@/lib/firestore/serialize";
import { SettingsAuditAction } from "@/lib/system-settings/audit";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { UpdateSystemSettingsInput } from "@/lib/validators/settings";
import { SettingsCurrency, UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import {
  DEFAULT_SYSTEM_SETTINGS,
  SETTINGS_SECTIONS,
  type SerializedSystemSettings,
  type SettingsSection,
  type SystemSettings,
  type SystemSettingsData,
} from "@/types/settings";

function getSettingsRef() {
  const db = getAdminDb();
  const refPath = firestorePaths.systemSettings();
  const [collection, docId] = refPath.split("/");
  return db.collection(collection).doc(docId);
}

function normalizeSettingsData(data: Record<string, unknown>): SystemSettingsData {
  const monthlyDuesAmount = Number(data.monthlyDuesAmount);
  const defaultAnnouncementExpiryDays = Number(data.defaultAnnouncementExpiryDays);
  const defaulterThresholdMonths = Number(data.defaulterThresholdMonths);

  return {
    organizationName:
      typeof data.organizationName === "string" && data.organizationName.trim()
        ? data.organizationName.trim()
        : DEFAULT_SYSTEM_SETTINGS.organizationName,
    portalName:
      typeof data.portalName === "string" && data.portalName.trim()
        ? data.portalName.trim()
        : DEFAULT_SYSTEM_SETTINGS.portalName,
    supportEmail:
      typeof data.supportEmail === "string"
        ? data.supportEmail.trim()
        : DEFAULT_SYSTEM_SETTINGS.supportEmail,
    supportPhone:
      typeof data.supportPhone === "string"
        ? data.supportPhone.trim()
        : DEFAULT_SYSTEM_SETTINGS.supportPhone,
    monthlyDuesAmount:
      Number.isFinite(monthlyDuesAmount) && monthlyDuesAmount > 0
        ? monthlyDuesAmount
        : DEFAULT_SYSTEM_SETTINGS.monthlyDuesAmount,
    currency:
      data.currency === SettingsCurrency.GHS
        ? SettingsCurrency.GHS
        : DEFAULT_SYSTEM_SETTINGS.currency,
    defaultAnnouncementExpiryDays:
      Number.isFinite(defaultAnnouncementExpiryDays) &&
      defaultAnnouncementExpiryDays >= 1
        ? defaultAnnouncementExpiryDays
        : DEFAULT_SYSTEM_SETTINGS.defaultAnnouncementExpiryDays,
    defaulterThresholdMonths:
      Number.isFinite(defaulterThresholdMonths) && defaulterThresholdMonths > 0
        ? defaulterThresholdMonths
        : DEFAULT_SYSTEM_SETTINGS.defaulterThresholdMonths,
    serviceNumberPrefix: DEFAULT_SYSTEM_SETTINGS.serviceNumberPrefix,
    receiptNumberPrefix:
      typeof data.receiptNumberPrefix === "string" && data.receiptNumberPrefix.trim()
        ? data.receiptNumberPrefix.trim()
        : DEFAULT_SYSTEM_SETTINGS.receiptNumberPrefix,
  };
}

function mapSystemSettings(
  data: Record<string, unknown>,
  updatedBy = "system",
): SystemSettings {
  const normalized = normalizeSettingsData(data);
  return {
    ...normalized,
    updatedAt:
      (data.updatedAt as SystemSettings["updatedAt"]) ??
      ({ seconds: 0, nanoseconds: 0 } as SystemSettings["updatedAt"]),
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : updatedBy,
  };
}

export function serializeSystemSettings(settings: SystemSettings): SerializedSystemSettings {
  const { updatedAt, updatedBy, ...rest } = settings;
  const serialized = serializeFirestoreFields({
    ...rest,
    updatedAt,
    updatedBy,
  });

  return {
    ...(serialized as Omit<SerializedSystemSettings, "updatedBy">),
    updatedBy,
  };
}

export function canManageSettings(role: UserRole): boolean {
  return hasPermission(role, Permission.MANAGE_SETTINGS);
}

async function createDefaultSettingsDocument(updatedBy: string): Promise<SystemSettings> {
  const ref = getSettingsRef();
  const payload = sanitizeFirestoreData({
    ...DEFAULT_SYSTEM_SETTINGS,
    updatedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createDefaultSettingsDocument", payload);
  await ref.set(payload);

  const created = await ref.get();
  return mapSystemSettings(created.data() as Record<string, unknown>, updatedBy);
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const ref = getSettingsRef();
  const doc = await ref.get();

  if (!doc.exists) {
    return createDefaultSettingsDocument("system");
  }

  return mapSystemSettings(doc.data() as Record<string, unknown>);
}

export async function getMonthlyDuesAmount(): Promise<number> {
  const settings = await getSystemSettings();
  return settings.monthlyDuesAmount;
}

export async function getDefaultAnnouncementExpiryDays(): Promise<number> {
  const settings = await getSystemSettings();
  return settings.defaultAnnouncementExpiryDays;
}

function getChangedSections(
  before: SystemSettingsData,
  after: UpdateSystemSettingsInput,
): SettingsSection[] {
  const sections: SettingsSection[] = [];

  if (
    before.organizationName !== after.organizationName ||
    before.portalName !== after.portalName ||
    before.supportEmail !== after.supportEmail ||
    before.supportPhone !== (after.supportPhone ?? "")
  ) {
    sections.push(SETTINGS_SECTIONS.ORGANIZATION);
  }

  if (
    before.monthlyDuesAmount !== after.monthlyDuesAmount ||
    before.currency !== after.currency
  ) {
    sections.push(SETTINGS_SECTIONS.FINANCE);
  }

  if (before.defaultAnnouncementExpiryDays !== after.defaultAnnouncementExpiryDays) {
    sections.push(SETTINGS_SECTIONS.COMMUNICATIONS);
  }

  return sections;
}

export async function updateSystemSettings(
  input: UpdateSystemSettingsInput,
  actor: CurrentUser,
): Promise<SerializedSystemSettings> {
  if (!canManageSettings(actor.role)) {
    throw new Error("You do not have permission to manage settings.");
  }

  const ref = getSettingsRef();
  const existingDoc = await ref.get();
  const existing = existingDoc.exists
    ? mapSystemSettings(existingDoc.data() as Record<string, unknown>, actor.uid)
    : mapSystemSettings({}, actor.uid);

  const nextSettings: SystemSettingsData = {
    ...existing,
    organizationName: input.organizationName.trim(),
    portalName: input.portalName.trim(),
    supportEmail: input.supportEmail.trim(),
    supportPhone: input.supportPhone?.trim() ?? "",
    monthlyDuesAmount: input.monthlyDuesAmount,
    currency: input.currency,
    defaultAnnouncementExpiryDays: input.defaultAnnouncementExpiryDays,
  };

  const changedSections = getChangedSections(existing, input);
  const payload = sanitizeFirestoreData({
    ...nextSettings,
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updateSystemSettings", payload);
  await ref.set(payload, { merge: true });

  const auditActor = buildAuditActor(actor);

  await createAuditLog({
    action: SettingsAuditAction.SETTINGS_UPDATED,
    entityType: "settings",
    entityId: "system",
    ...auditActor,
    metadata: {
      changedSections,
      updatedByName: actor.fullName,
    },
  });

  const updated = await getSystemSettings();
  return serializeSystemSettings(updated);
}
