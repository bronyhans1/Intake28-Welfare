import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@/types/enums";
import type { CurrentUser } from "@/types/auth";

const mockGetMemberById = vi.fn();

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

const {
  resolveOwnMemberId,
  requireOwnMemberId,
  assertOwnMemberScope,
  hasOwnMemberPortalRole,
} = await import("@/lib/members/member-context");

const memberActor: CurrentUser = {
  uid: "member-1",
  fullName: "Brony Hans",
  serviceNumber: "IS/10002",
  role: UserRole.MEMBER,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const treasurerActor: CurrentUser = {
  uid: "treasurer-1",
  fullName: "Treasurer User",
  serviceNumber: "IS/10002",
  role: UserRole.TREASURER,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const adminActor: CurrentUser = {
  uid: "admin-1",
  fullName: "Admin User",
  serviceNumber: "IS/00001",
  role: UserRole.ADMIN,
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hasOwnMemberPortalRole", () => {
  it("includes member, admin, and treasurer roles", () => {
    expect(hasOwnMemberPortalRole(UserRole.MEMBER)).toBe(true);
    expect(hasOwnMemberPortalRole(UserRole.ADMIN)).toBe(true);
    expect(hasOwnMemberPortalRole(UserRole.TREASURER)).toBe(true);
  });
});

describe("resolveOwnMemberId", () => {
  it("returns actor uid when a member record exists", async () => {
    mockGetMemberById.mockResolvedValue({ id: "member-1" });

    await expect(resolveOwnMemberId(memberActor)).resolves.toBe("member-1");
  });

  it("returns null when executive has no linked member record", async () => {
    mockGetMemberById.mockResolvedValue(null);

    await expect(resolveOwnMemberId(adminActor)).resolves.toBeNull();
  });

  it("returns uid for linked executive member account", async () => {
    mockGetMemberById.mockResolvedValue({ id: "treasurer-1" });

    await expect(resolveOwnMemberId(treasurerActor)).resolves.toBe("treasurer-1");
  });
});

describe("requireOwnMemberId", () => {
  it("throws when no linked member exists", async () => {
    mockGetMemberById.mockResolvedValue(null);

    await expect(requireOwnMemberId(adminActor)).rejects.toThrow(
      "Member context required.",
    );
  });

  it("returns actor uid for linked member", async () => {
    mockGetMemberById.mockResolvedValue({ id: "treasurer-1" });

    await expect(requireOwnMemberId(treasurerActor)).resolves.toBe("treasurer-1");
  });
});

describe("assertOwnMemberScope", () => {
  it("allows actor uid", () => {
    expect(() => assertOwnMemberScope("member-1", memberActor)).not.toThrow();
  });

  it("rejects another member id", () => {
    expect(() => assertOwnMemberScope("other-member", memberActor)).toThrow(
      "Forbidden: member scope violation.",
    );
  });
});
