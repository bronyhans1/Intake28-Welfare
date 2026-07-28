import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsAuditAction } from "@/lib/system-settings/audit";
import {
  canManageSettings,
  getDefaultAnnouncementExpiryDays,
  getMonthlyDuesAmount,
  getSystemSettings,
  updateSystemSettings,
} from "@/lib/system-settings/repository";
import {
  formatAuditActionLabel,
  formatAuditDescription,
  formatAuditEntityLabel,
} from "@/lib/audit/labels";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { updateSystemSettingsSchema } from "@/lib/validators/settings";
import { DEFAULT_SYSTEM_SETTINGS } from "@/types/settings";
import { SettingsCurrency, UserRole } from "@/types/enums";

const mockCreateAuditLog = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

const actor = {
  uid: "admin-1",
  fullName: "Harrison Oduro",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

describe("settings permissions", () => {
  it("allows only admins to manage settings", () => {
    expect(canManageSettings(UserRole.ADMIN)).toBe(true);
    expect(canManageSettings(UserRole.TREASURER)).toBe(false);
    expect(canManageSettings(UserRole.MEMBER)).toBe(false);
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_SETTINGS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.MANAGE_SETTINGS)).toBe(false);
  });
});

describe("settings validation", () => {
  it("requires organization and portal names", () => {
    const result = updateSystemSettingsSchema.safeParse({
      organizationName: "",
      portalName: "",
      supportEmail: "support@example.com",
      monthlyDuesAmount: 50,
      currency: SettingsCurrency.GHS,
      defaultAnnouncementExpiryDays: 30,
    });

    expect(result.success).toBe(false);
  });

  it("requires monthly dues and expiry days to be at least 1", () => {
    const result = updateSystemSettingsSchema.safeParse({
      organizationName: "GIS Intake 28 Welfare Association",
      portalName: "GIS Intake 28 Welfare Portal",
      supportEmail: "support@example.com",
      monthlyDuesAmount: 0,
      currency: SettingsCurrency.GHS,
      defaultAnnouncementExpiryDays: 0,
    });

    expect(result.success).toBe(false);
  });

  it("accepts valid settings input", () => {
    const result = updateSystemSettingsSchema.safeParse({
      organizationName: "GIS Intake 28 Welfare Association",
      portalName: "GIS Intake 28 Welfare Portal",
      supportEmail: "support@example.com",
      supportPhone: "+233201234567",
      monthlyDuesAmount: 75,
      currency: SettingsCurrency.GHS,
      defaultAnnouncementExpiryDays: 45,
    });

    expect(result.success).toBe(true);
  });

  it("accepts empty support email", () => {
    const result = updateSystemSettingsSchema.safeParse({
      organizationName: "GIS Intake 28 Welfare Association",
      portalName: "GIS Intake 28 Welfare Portal",
      supportEmail: "",
      monthlyDuesAmount: 50,
      currency: SettingsCurrency.GHS,
      defaultAnnouncementExpiryDays: 30,
    });

    expect(result.success).toBe(true);
  });
});

describe("system settings repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockDoc.mockReturnValue({ get: mockGet, set: mockSet });
    mockGet.mockReset();
    mockSet.mockResolvedValue(undefined);
  });

  it("creates default settings when document does not exist", async () => {
    mockGet
      .mockResolvedValueOnce({ exists: false })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          ...DEFAULT_SYSTEM_SETTINGS,
          updatedBy: "system",
          updatedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
        }),
      });

    const settings = await getSystemSettings();

    expect(mockSet).toHaveBeenCalled();
    expect(settings.monthlyDuesAmount).toBe(50);
    expect(settings.currency).toBe(SettingsCurrency.GHS);
    expect(settings.defaultAnnouncementExpiryDays).toBe(30);
    expect(settings.organizationName).toBe("GIS Intake 28 Welfare Association");
  });

  it("returns configured monthly dues amount", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ...DEFAULT_SYSTEM_SETTINGS,
        monthlyDuesAmount: 75,
        updatedBy: "admin-1",
        updatedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
      }),
    });

    await expect(getMonthlyDuesAmount()).resolves.toBe(75);
  });

  it("returns configured default announcement expiry days", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        ...DEFAULT_SYSTEM_SETTINGS,
        defaultAnnouncementExpiryDays: 14,
        updatedBy: "admin-1",
        updatedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
      }),
    });

    await expect(getDefaultAnnouncementExpiryDays()).resolves.toBe(14);
  });

  it("updates settings and logs settings_updated", async () => {
    mockGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          ...DEFAULT_SYSTEM_SETTINGS,
          updatedBy: "admin-1",
          updatedAt: makeTimestamp("2026-06-01T00:00:00.000Z"),
        }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          ...DEFAULT_SYSTEM_SETTINGS,
          monthlyDuesAmount: 60,
          portalName: "Updated Portal Name",
          updatedBy: "admin-1",
          updatedAt: makeTimestamp("2026-06-17T00:00:00.000Z"),
        }),
      });

    const updated = await updateSystemSettings(
      {
        organizationName: "GIS Intake 28 Welfare Association",
        portalName: "Updated Portal Name",
        supportEmail: "support@example.com",
        supportPhone: "+233201234567",
        monthlyDuesAmount: 60,
        currency: SettingsCurrency.GHS,
        defaultAnnouncementExpiryDays: 30,
      },
      actor,
    );

    expect(mockSet).toHaveBeenCalled();
    expect(updated.monthlyDuesAmount).toBe(60);
    expect(updated.portalName).toBe("Updated Portal Name");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: SettingsAuditAction.SETTINGS_UPDATED,
        entityType: "settings",
        entityId: "system",
        metadata: expect.objectContaining({
          updatedByName: "Harrison Oduro",
          changedSections: expect.arrayContaining(["finance", "organization"]),
        }),
      }),
    );
  });

  it("prevents non-admins from updating settings", async () => {
    await expect(
      updateSystemSettings(
        {
          organizationName: "GIS Intake 28 Welfare Association",
          portalName: "GIS Intake 28 Welfare Portal",
          supportEmail: "support@example.com",
          monthlyDuesAmount: 50,
          currency: SettingsCurrency.GHS,
          defaultAnnouncementExpiryDays: 30,
        },
        { ...actor, role: UserRole.TREASURER },
      ),
    ).rejects.toThrow("You do not have permission to manage settings.");
  });
});

describe("settings audit labels", () => {
  it("formats settings audit labels and descriptions", () => {
    expect(formatAuditActionLabel(SettingsAuditAction.SETTINGS_UPDATED)).toBe(
      "Settings updated",
    );
    expect(formatAuditEntityLabel("settings", "system")).toBe("System Settings");
    expect(
      formatAuditDescription(SettingsAuditAction.SETTINGS_UPDATED, {
        updatedByName: "Harrison Oduro",
      }),
    ).toBe("Settings updated by Harrison Oduro");
  });
});
