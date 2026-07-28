import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContributionAuditAction } from "@/lib/contributions/audit";
import { ContributionStatus, ContributionType, UserRole } from "@/types/enums";
import { hasPermission, Permission } from "@/lib/auth/permissions";

const mockCreateAuditLog = vi.fn();
const mockGetMonthlyDuesAmount = vi.fn();
const mockGetMemberById = vi.fn();
const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockSet = vi.fn();
const mockGet = vi.fn();
const mockUpdate = vi.fn();
const mockOrderBy = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getMonthlyDuesAmount: () => mockGetMonthlyDuesAmount(),
}));

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/progression", () => ({
  recalculateMembershipProgression: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

import {
  canManageContributions,
  canViewContributions,
  createContribution,
  getContributionMonths,
  getContributionStats,
  listContributions,
  updateContribution,
} from "@/lib/contributions/repository";

const actor = {
  uid: "actor-1",
  fullName: "Treasurer One",
  role: "treasurer" as const,
};

const baseRecord = {
  id: "c1",
  memberId: "m1",
  memberName: "John Doe",
  serviceNumber: "IS/13984",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  month: 6,
  year: 2026,
  status: ContributionStatus.PAID,
  remarks: null,
  recordedBy: "actor-1",
  recordedByName: "Treasurer One",
  contributionMonth: 6,
  contributionYear: 2026,
  createdAt: { seconds: 0, nanoseconds: 0 },
  updatedAt: { seconds: 0, nanoseconds: 0 },
};

describe("ContributionAuditAction", () => {
  it("has contribution_created", () => {
    expect(ContributionAuditAction.CONTRIBUTION_CREATED).toBe("contribution_created");
  });

  it("has contribution_updated", () => {
    expect(ContributionAuditAction.CONTRIBUTION_UPDATED).toBe("contribution_updated");
  });
});

describe("contributions permissions", () => {
  it("allows admin to view/create/manage contributions", () => {
    expect(hasPermission(UserRole.ADMIN, Permission.VIEW_CONTRIBUTIONS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.CREATE_CONTRIBUTIONS)).toBe(true);
    expect(hasPermission(UserRole.ADMIN, Permission.MANAGE_CONTRIBUTIONS)).toBe(true);
  });

  it("allows treasurer to view/create/manage contributions", () => {
    expect(hasPermission(UserRole.TREASURER, Permission.VIEW_CONTRIBUTIONS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.CREATE_CONTRIBUTIONS)).toBe(true);
    expect(hasPermission(UserRole.TREASURER, Permission.MANAGE_CONTRIBUTIONS)).toBe(true);
  });

  it("does NOT allow member to create/manage contributions", () => {
    expect(hasPermission(UserRole.MEMBER, Permission.CREATE_CONTRIBUTIONS)).toBe(false);
    expect(hasPermission(UserRole.MEMBER, Permission.MANAGE_CONTRIBUTIONS)).toBe(false);
  });
});

describe("repository helpers", () => {
  it("getContributionMonths returns inclusive month range", () => {
    expect(
      getContributionMonths({ year: 2026, month: 11 }, { year: 2027, month: 2 }),
    ).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });

  it("canViewContributions maps to permission", () => {
    expect(canViewContributions("admin")).toBe(true);
    expect(canViewContributions("treasurer")).toBe(true);
    expect(canViewContributions("member")).toBe(true);
  });

  it("canManageContributions maps to permission", () => {
    expect(canManageContributions("admin")).toBe(true);
    expect(canManageContributions("treasurer")).toBe(true);
    expect(canManageContributions("member")).toBe(false);
  });
});

describe("contributions repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSet.mockResolvedValue(undefined);
    mockUpdate.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({
      exists: true,
      id: "c1",
      data: () => ({ ...baseRecord, id: undefined }),
    });

    mockDoc.mockReturnValue({
      id: "c1",
      set: mockSet,
      get: mockGet,
      update: mockUpdate,
    });

    mockOrderBy.mockReturnValue({
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "c1", data: () => ({ ...baseRecord, id: undefined }) },
          { id: "c2", data: () => ({ ...baseRecord, id: undefined, memberId: "m2", amount: 100 }) },
        ],
      }),
    });

    mockCollection.mockReturnValue({
      doc: mockDoc,
      orderBy: mockOrderBy,
    });

    mockGetMonthlyDuesAmount.mockResolvedValue(50);
    mockGetMemberById.mockResolvedValue({ id: "m1", fullName: "John Doe" });
  });

  it("createContribution stores derived reporting fields and audits", async () => {
    const input = {
      memberId: "m1",
      memberName: "John Doe",
      serviceNumber: "IS/13984",
      contributionType: ContributionType.MONTHLY_DUES,
      amount: 50,
      month: 6,
      year: 2026,
      remarks: "Paid",
    };

    const result = await createContribution(input, actor);

    expect(result.recordId).toBe("c1");
    expect(mockGetMonthlyDuesAmount).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        memberId: "m1",
        contributionMonth: 6,
        contributionYear: 2026,
        status: ContributionStatus.PAID,
        recordedBy: "actor-1",
      }),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ContributionAuditAction.CONTRIBUTION_CREATED,
        entityType: "contribution",
      }),
    );
  });

  it("updateContribution updates editable fields and audits changes", async () => {
    await updateContribution(
      "c1",
      {
        contributionType: ContributionType.OTHER,
        amount: 75,
        remarks: "Updated",
      },
      actor,
    );

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        contributionType: ContributionType.OTHER,
        amount: 75,
      }),
    );
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ContributionAuditAction.CONTRIBUTION_UPDATED,
        entityId: "c1",
        changes: expect.any(Object),
      }),
    );
  });

  it("listContributions filters by search and paginates", async () => {
    const result = await listContributions({
      page: 1,
      pageSize: 1,
      search: "IS/13984",
    });

    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.records).toHaveLength(1);
  });

  it("getContributionStats counts paid contributions only", async () => {
    const stats = await getContributionStats();
    expect(stats.totalContributions).toBe(2);
    expect(stats.totalAmountCollected).toBe(150);
    expect(stats.membersContributed).toBe(2);
  });
});

