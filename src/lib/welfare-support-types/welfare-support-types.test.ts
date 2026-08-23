import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { canAccessRoute } from "@/lib/auth/routes";
import { WelfareSupportTypeAuditAction } from "@/lib/welfare-support-types/audit";
import {
  resolveWelfareSupportTypeDisplayName,
  buildWelfareSupportTypeLabelMap,
} from "@/lib/welfare-support-types/labels";
import { DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS } from "@/lib/welfare-support-types/seed-data";
import {
  canManageWelfareSupportTypes,
  canViewWelfareSupportTypeCatalog,
  createWelfareSupportTypeConfig,
  listActiveWelfareSupportTypes,
  listAllWelfareSupportTypeOptions,
  listWelfareSupportTypeConfigs,
  listWelfareSupportTypeOptionsForEdit,
  seedDefaultWelfareSupportTypes,
  updateWelfareSupportTypeConfig,
  assertSupportTypeAllowedForCreate,
  assertSupportTypeAllowedForUpdate,
} from "@/lib/welfare-support-types/repository";
import {
  createWelfareSupportTypeConfigSchema,
  updateWelfareSupportTypeConfigSchema,
  welfareSupportTypeCodeSchema,
} from "@/lib/welfare-support-types/validation";
import { createWelfareSupportSchema } from "@/lib/validators/welfare-support";
import { UserRole, WELFARE_SUPPORT_TYPE_LABELS } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

const mockCreateAuditLog = vi.fn();

type StoreDoc = {
  id: string;
  data: Record<string, unknown>;
};

const store = new Map<string, StoreDoc>();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      if (name !== "welfare_support_type_configs") {
        throw new Error(`Unexpected collection: ${name}`);
      }
      return {
        doc: (id?: string) => {
          const docId = id ?? `auto-${store.size + 1}`;
          return {
            id: docId,
            get: async () => {
              const existing = store.get(docId);
              return {
                id: docId,
                exists: Boolean(existing),
                data: () => existing?.data,
              };
            },
            set: async (payload: Record<string, unknown>) => {
              store.set(docId, { id: docId, data: { ...payload } });
            },
            update: async (payload: Record<string, unknown>) => {
              const existing = store.get(docId);
              if (!existing) throw new Error("missing");
              store.set(docId, {
                id: docId,
                data: { ...existing.data, ...payload },
              });
            },
          };
        },
        get: async () => ({
          docs: [...store.values()].map((doc) => ({
            id: doc.id,
            data: () => doc.data,
          })),
        }),
        where: (field: string, _op: string, value: unknown) => ({
          limit: () => ({
            get: async () => {
              const matches = [...store.values()].filter(
                (doc) => doc.data[field] === value,
              );
              return {
                empty: matches.length === 0,
                docs: matches.map((doc) => ({
                  id: doc.id,
                  data: () => doc.data,
                })),
              };
            },
          }),
        }),
      };
    },
  }),
}));

const actor: CurrentUser = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/00001",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

describe("welfare support type permissions", () => {
  it("allows only admins to manage the catalog", () => {
    expect(canManageWelfareSupportTypes(UserRole.ADMIN)).toBe(true);
    expect(canManageWelfareSupportTypes(UserRole.TREASURER)).toBe(false);
    expect(canManageWelfareSupportTypes(UserRole.MEMBER)).toBe(false);
    expect(
      hasPermission(UserRole.ADMIN, Permission.MANAGE_WELFARE_SUPPORT_TYPES),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.MANAGE_WELFARE_SUPPORT_TYPES),
    ).toBe(false);
  });

  it("allows treasurer to view catalog options for recording", () => {
    expect(canViewWelfareSupportTypeCatalog(UserRole.TREASURER)).toBe(true);
    expect(canViewWelfareSupportTypeCatalog(UserRole.ADMIN)).toBe(true);
    expect(canViewWelfareSupportTypeCatalog(UserRole.MEMBER)).toBe(false);
  });

  it("blocks treasurer from support types admin route", () => {
    expect(canAccessRoute(UserRole.ADMIN, "/admin/welfare-support/types")).toBe(
      true,
    );
    expect(
      canAccessRoute(UserRole.TREASURER, "/admin/welfare-support/types"),
    ).toBe(false);
    expect(
      canAccessRoute(UserRole.TREASURER, "/admin/welfare-support/new"),
    ).toBe(true);
  });
});

describe("welfare support type code validation", () => {
  it("accepts stable lowercase underscore codes", () => {
    for (const code of ["funeral", "medical", "naming_ceremony", "emergency_support"]) {
      expect(welfareSupportTypeCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejects invalid codes", () => {
    for (const code of ["Funeral", "medical support", "medical-support", "1funeral", ""]) {
      expect(welfareSupportTypeCodeSchema.safeParse(code).success).toBe(false);
    }
  });

  it("rejects blank display names on create", () => {
    const result = createWelfareSupportTypeConfigSchema.safeParse({
      code: "funeral",
      displayName: "   ",
      description: "",
      active: true,
      sortOrder: 10,
    });
    expect(result.success).toBe(false);
  });

  it("omits code from update schema", () => {
    const result = updateWelfareSupportTypeConfigSchema.safeParse({
      displayName: "Funeral Support",
      description: "",
      active: true,
      sortOrder: 10,
      code: "changed",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("code" in result.data).toBe(false);
    }
  });
});

describe("resolveWelfareSupportTypeDisplayName", () => {
  it("prefers catalog display name including inactive configs", () => {
    expect(
      resolveWelfareSupportTypeDisplayName("funeral", {
        funeral: "Funeral Assistance Updated",
      }),
    ).toBe("Funeral Assistance Updated");
  });

  it("falls back to legacy enum labels", () => {
    expect(resolveWelfareSupportTypeDisplayName("funeral")).toBe(
      WELFARE_SUPPORT_TYPE_LABELS.funeral,
    );
  });

  it("falls back to stored code when config is missing", () => {
    expect(resolveWelfareSupportTypeDisplayName("custom_aid")).toBe("custom_aid");
  });

  it("never returns blank for a historical code", () => {
    expect(resolveWelfareSupportTypeDisplayName("bereavement")).toBeTruthy();
    expect(resolveWelfareSupportTypeDisplayName("legacy_code_x")).toBe(
      "legacy_code_x",
    );
  });

  it("builds a label map from configs", () => {
    const map = buildWelfareSupportTypeLabelMap([
      {
        id: "funeral",
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: false,
        sortOrder: 10,
        createdById: "a",
        createdByName: "A",
        updatedById: "a",
        updatedByName: "A",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(map.get("funeral")).toBe("Funeral Support");
    expect(
      resolveWelfareSupportTypeDisplayName("funeral", map),
    ).toBe("Funeral Support");
  });
});

describe("welfare support type repository", () => {
  beforeEach(() => {
    store.clear();
    mockCreateAuditLog.mockReset();
  });

  it("creates a type with stable code identity", async () => {
    const result = await createWelfareSupportTypeConfig(
      {
        code: "child_naming",
        displayName: "Child Naming Support",
        description: "Standalone assistance",
        active: true,
        sortOrder: 35,
      },
      actor,
    );

    expect(result.typeId).toBe("child_naming");
    expect(store.get("child_naming")?.data.code).toBe("child_naming");
    expect(store.get("child_naming")?.data.displayName).toBe(
      "Child Naming Support",
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: WelfareSupportTypeAuditAction.WELFARE_SUPPORT_TYPE_CREATED,
        entityType: "welfare_support_type_config",
      }),
    );
  });

  it("rejects duplicate codes", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: true,
        sortOrder: 10,
      },
      actor,
    );

    await expect(
      createWelfareSupportTypeConfig(
        {
          code: "funeral",
          displayName: "Duplicate",
          description: "",
          active: true,
          sortOrder: 11,
        },
        actor,
      ),
    ).rejects.toThrow(/already exists/i);
  });

  it("updates display name without changing code", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "medical",
        displayName: "Medical Assistance",
        description: "",
        active: true,
        sortOrder: 40,
      },
      actor,
    );

    await updateWelfareSupportTypeConfig(
      "medical",
      {
        displayName: "Medical Support",
        description: "Updated",
        active: true,
        sortOrder: 40,
      },
      actor,
    );

    expect(store.get("medical")?.data.code).toBe("medical");
    expect(store.get("medical")?.data.displayName).toBe("Medical Support");
  });

  it("lists active types only for new recording dropdown", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: true,
        sortOrder: 10,
      },
      actor,
    );
    await createWelfareSupportTypeConfig(
      {
        code: "wedding",
        displayName: "Wedding Support",
        description: "",
        active: false,
        sortOrder: 20,
      },
      actor,
    );

    const active = await listActiveWelfareSupportTypes();
    expect(active.map((type) => type.code)).toEqual(["funeral"]);

    const all = await listAllWelfareSupportTypeOptions();
    expect(all.map((type) => type.code).sort()).toEqual(["funeral", "wedding"]);
  });

  it("includes inactive current type on edit options", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: true,
        sortOrder: 10,
      },
      actor,
    );
    await createWelfareSupportTypeConfig(
      {
        code: "wedding",
        displayName: "Wedding Support",
        description: "",
        active: false,
        sortOrder: 20,
      },
      actor,
    );

    const options = await listWelfareSupportTypeOptionsForEdit("wedding");
    expect(options.some((type) => type.code === "funeral" && type.active)).toBe(
      true,
    );
    expect(options.some((type) => type.code === "wedding" && !type.active)).toBe(
      true,
    );
  });

  it("sorts by sortOrder then code", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "zeta",
        displayName: "Zeta",
        description: "",
        active: true,
        sortOrder: 20,
      },
      actor,
    );
    await createWelfareSupportTypeConfig(
      {
        code: "alpha",
        displayName: "Alpha",
        description: "",
        active: true,
        sortOrder: 10,
      },
      actor,
    );
    await createWelfareSupportTypeConfig(
      {
        code: "beta",
        displayName: "Beta",
        description: "",
        active: true,
        sortOrder: 10,
      },
      actor,
    );

    const listed = await listWelfareSupportTypeConfigs({
      page: 1,
      pageSize: 20,
    });
    expect(listed.types.map((type) => type.code)).toEqual([
      "alpha",
      "beta",
      "zeta",
    ]);
  });

  it("allows create only for active catalog codes", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: false,
        sortOrder: 10,
      },
      actor,
    );

    await expect(assertSupportTypeAllowedForCreate("funeral")).rejects.toThrow(
      /inactive/i,
    );
    await expect(assertSupportTypeAllowedForCreate("missing")).rejects.toThrow(
      /valid support type/i,
    );
  });

  it("allows update to keep an inactive existing code", async () => {
    await createWelfareSupportTypeConfig(
      {
        code: "funeral",
        displayName: "Funeral Support",
        description: "",
        active: false,
        sortOrder: 10,
      },
      actor,
    );

    await expect(
      assertSupportTypeAllowedForUpdate("funeral", "funeral"),
    ).resolves.toBeUndefined();
  });

  it("seeds defaults idempotently without overwriting", async () => {
    const first = await seedDefaultWelfareSupportTypes(actor);
    expect(first.created).toHaveLength(DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS.length);
    expect(first.skipped).toHaveLength(0);

    store.get("funeral")!.data.displayName = "Custom Funeral Label";

    const second = await seedDefaultWelfareSupportTypes(actor);
    expect(second.created).toHaveLength(0);
    expect(second.skipped).toHaveLength(DEFAULT_WELFARE_SUPPORT_TYPE_SEEDS.length);
    expect(store.get("funeral")?.data.displayName).toBe("Custom Funeral Label");
  });
});

describe("welfare support create schema with catalog codes", () => {
  it("accepts stable catalog-style codes", () => {
    const result = createWelfareSupportSchema.safeParse({
      memberId: "m1",
      memberName: "Member",
      serviceNumber: "IS/1",
      supportType: "custom_aid",
      amount: 100,
      description: "Standalone aid",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid support type code formats", () => {
    const result = createWelfareSupportSchema.safeParse({
      memberId: "m1",
      memberName: "Member",
      serviceNumber: "IS/1",
      supportType: "Invalid Type",
      amount: 100,
      description: "Standalone aid",
    });
    expect(result.success).toBe(false);
  });
});
