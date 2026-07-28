import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimStatus, UserRole } from "@/types/enums";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import { ClaimLifecycleAuditType } from "@/lib/claims/claim-lifecycle-audit";
import { ELIGIBILITY_REASONS } from "@/lib/claims/eligibility-engine";

const mockCreateAuditLog = vi.fn();
const mockEvaluateEligibility = vi.fn();
const mockAllocateClaimNumber = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/claims/claim-progression", () => ({
  evaluateClaimSubmissionEligibility: (...args: unknown[]) =>
    mockEvaluateEligibility(...args),
  assertMemberEligibleToClaim: vi.fn(),
  buildClaimProgressionSnapshot: (input: {
    progression: Record<string, unknown>;
    recommendedAmount: number;
    claimCeiling: number;
  }) => ({
    welfarePoints: input.progression.welfarePoints,
    benefitPercentage: input.progression.benefitPercentage,
    membershipStatus: input.progression.membershipStatus,
    isMature: input.progression.isMature,
    eligibleToClaim: input.progression.eligibleToClaim,
    recommendedAmount: input.recommendedAmount,
    claimCeiling: input.claimCeiling,
    calculatedAt: "2026-07-26T10:00:00.000Z",
  }),
}));

vi.mock("@/lib/claims/claim-number", async () => {
  const actual = await vi.importActual<typeof import("@/lib/claims/claim-number")>(
    "@/lib/claims/claim-number",
  );
  return {
    ...actual,
    allocateClaimNumber: (...args: unknown[]) => mockAllocateClaimNumber(...args),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn(),
}));

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/13984",
  email: "member@example.com",
};

const adminActor = {
  uid: "admin-1",
  fullName: "Admin User",
  role: UserRole.ADMIN,
  serviceNumber: "IS/1",
  email: "admin@example.com",
};

const draftData = {
  reference: "DRAFT-CLAIM01",
  claimNumber: null,
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/13984",
  claimTypeCode: "medical",
  claimTypeDisplayName: "Medical",
  status: ClaimStatus.DRAFT,
  title: "Hospital visit",
  description: "Required surgery support",
  incidentDate: "2026-07-01",
  auditHistory: [
    {
      id: "cae_1",
      type: ClaimLifecycleAuditType.CLAIM_CREATED,
      title: "Claim Created",
      performedByUserId: "member-1",
      performedByName: "Member User",
      performedByRole: UserRole.MEMBER,
      createdAt: "2026-07-01T00:00:00.000Z",
      reason: null,
      metadata: {},
    },
  ],
  currency: "GHS",
  createdBy: "member-1",
  createdByName: "Member User",
  createdAt: { seconds: 1, nanoseconds: 0 },
  updatedAt: { seconds: 1, nanoseconds: 0 },
};

const submittedData = {
  ...draftData,
  status: ClaimStatus.SUBMITTED,
  claimNumber: "GIS-2026-00001",
  reference: "GIS-2026-00001",
  submittedAt: "2026-07-10T12:00:00.000Z",
};

const needsRevisionData = {
  ...submittedData,
  status: ClaimStatus.NEEDS_REVISION,
  returnReason: "Please provide more information.",
  returnedById: "admin-1",
  returnedByName: "Admin User",
};

function mockClaimDoc(data: Record<string, unknown>) {
  mockGet.mockResolvedValue({
    exists: true,
    id: "claim-1",
    data: () => ({ ...data }),
  });
}

describe("Phase 4A claim lock, return, and resubmit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate });
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockUpdate.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockAllocateClaimNumber.mockResolvedValue("GIS-2026-00001");
  });

  it("blocks editing and deleting submitted claims", async () => {
    const {
      updateClaimDraft,
      deleteClaimDraft,
    } = await import("@/lib/claims/claim-repository");

    mockClaimDoc(submittedData);

    await expect(
      updateClaimDraft(
        "claim-1",
        {
          claimTypeCode: "funeral",
          title: "Changed",
          description: "Changed",
          incidentDate: "2026-07-01",
        },
        memberActor as never,
      ),
    ).rejects.toThrow(/no longer be edited/i);

    await expect(
      deleteClaimDraft("claim-1", memberActor as never),
    ).rejects.toThrow(/no longer be deleted/i);
  });

  it("blocks claim type changes after submission via revision update path", async () => {
    const { updateClaimRevision, canMemberChangeClaimType } = await import(
      "@/lib/claims/claim-repository"
    );

    expect(canMemberChangeClaimType(ClaimStatus.SUBMITTED)).toBe(false);
    expect(canMemberChangeClaimType(ClaimStatus.NEEDS_REVISION)).toBe(false);
    expect(canMemberChangeClaimType(ClaimStatus.DRAFT)).toBe(true);

    mockClaimDoc(needsRevisionData);
    await updateClaimRevision(
      "claim-1",
      {
        title: "Updated title",
        description: "Updated description",
        incidentDate: "2026-07-02",
        whatsappEvidenceNote: null,
        attachmentUrl: null,
        attachmentPath: null,
        attachmentFileName: null,
        attachmentContentType: null,
      },
      memberActor as never,
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("claimTypeCode");
    expect(payload).not.toHaveProperty("claimNumber");
  });

  it("allows administrator to return for revision with mandatory reason", async () => {
    const { returnClaimForRevision } = await import(
      "@/lib/claims/claim-repository"
    );
    mockClaimDoc(submittedData);

    await returnClaimForRevision(
      "claim-1",
      {
        reasonPreset: "Please provide more information.",
        customReason: null,
      },
      adminActor as never,
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe(ClaimStatus.NEEDS_REVISION);
    expect(payload.returnReason).toBe("Please provide more information.");
    expect(payload.returnedById).toBe("admin-1");
    expect(Array.isArray(payload.auditHistory)).toBe(true);
    const history = payload.auditHistory as Array<{ type: string; reason: string | null }>;
    expect(history.some((event) => event.type === "CLAIM_RETURNED_FOR_REVISION")).toBe(
      true,
    );
    expect(
      history.find((event) => event.type === "CLAIM_RETURNED_FOR_REVISION")?.reason,
    ).toBe("Please provide more information.");
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ClaimsAuditAction.CLAIM_RETURNED_FOR_REVISION,
      }),
    );
  });

  it("rejects return without a usable reason when Other is selected", async () => {
    const { returnClaimForRevision } = await import(
      "@/lib/claims/claim-repository"
    );
    mockClaimDoc(submittedData);

    await expect(
      returnClaimForRevision(
        "claim-1",
        { reasonPreset: "Other", customReason: null },
        adminActor as never,
      ),
    ).rejects.toThrow(/custom return reason/i);
  });

  it("allows members to edit only after return for revision", async () => {
    const { updateClaimRevision } = await import("@/lib/claims/claim-repository");
    mockClaimDoc(submittedData);

    await expect(
      updateClaimRevision(
        "claim-1",
        {
          title: "Nope",
          description: "Nope",
          incidentDate: "2026-07-01",
        },
        memberActor as never,
      ),
    ).rejects.toThrow(/returned for revision/i);

    mockClaimDoc(needsRevisionData);
    await updateClaimRevision(
      "claim-1",
      {
        title: "Revised",
        description: "Revised description",
        incidentDate: "2026-07-03",
      },
      memberActor as never,
    );
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("runs eligibility again on resubmission and preserves claim number + submittedAt", async () => {
    const { resubmitClaim } = await import("@/lib/claims/claim-repository");
    mockClaimDoc(needsRevisionData);
    mockEvaluateEligibility.mockResolvedValue({
      eligible: true,
      reasons: [],
      warnings: [],
      memberStatus: "ACTIVE",
      constitutionVersion: "2026 Constitution",
      benefitPercentage: 25,
      checks: [],
      waitingPeriodDays: 180,
      membershipDays: 400,
      welfarePoints: 6,
      isMature: true,
      eligibleToClaim: true,
      membershipProgressionStatus: "ACTIVE",
      recommendedAmount: 250,
      claimCeiling: 1000,
      progression: {
        memberId: "member-1",
        welfarePoints: 6,
        benefitPercentage: 25,
        membershipStatus: "ACTIVE",
        isMature: true,
        eligibleToClaim: true,
        successfulContributionMonths: 6,
        consecutiveContributionMonths: 6,
        consecutiveMissedMonths: 0,
        outstandingContributionMonths: 0,
        outstandingMonths: [],
        maturityDate: null,
        lastSuccessfulContributionDate: null,
        lastCalculatedAt: "2026-07-26T10:00:00.000Z",
      },
    });

    const result = await resubmitClaim("claim-1", memberActor as never);

    expect(result.claimNumber).toBe("GIS-2026-00001");
    expect(mockEvaluateEligibility).toHaveBeenCalledWith({
      memberId: "member-1",
      claimTypeCode: "medical",
    });
    expect(mockAllocateClaimNumber).not.toHaveBeenCalled();

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe(ClaimStatus.SUBMITTED);
    expect(payload.claimNumber).toBe("GIS-2026-00001");
    expect(payload).not.toHaveProperty("submittedAt");
    const history = payload.auditHistory as Array<{ type: string }>;
    expect(history.some((event) => event.type === "CLAIM_RESUBMITTED")).toBe(true);
  });

  it("rejects resubmission when eligibility fails", async () => {
    const { resubmitClaim } = await import("@/lib/claims/claim-repository");
    mockClaimDoc(needsRevisionData);
    mockEvaluateEligibility.mockResolvedValue({
      eligible: false,
      reasons: [ELIGIBILITY_REASONS.WAITING_PERIOD],
      warnings: [],
      memberStatus: "Active",
      constitutionVersion: "",
      benefitPercentage: 0,
      checks: [],
      waitingPeriodDays: 365,
      membershipDays: 1,
    });

    await expect(resubmitClaim("claim-1", memberActor as never)).rejects.toThrow(
      ELIGIBILITY_REASONS.WAITING_PERIOD,
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("records structured CLAIM_SUBMITTED audit on first submit", async () => {
    const { submitClaimDraft } = await import("@/lib/claims/claim-repository");
    mockClaimDoc(draftData);
    mockEvaluateEligibility.mockResolvedValue({
      eligible: true,
      reasons: [],
      warnings: [],
      memberStatus: "ACTIVE",
      constitutionVersion: "2026 Constitution",
      benefitPercentage: 25,
      checks: [],
      waitingPeriodDays: 180,
      membershipDays: 400,
      welfarePoints: 6,
      isMature: true,
      eligibleToClaim: true,
      membershipProgressionStatus: "ACTIVE",
      recommendedAmount: 250,
      claimCeiling: 1000,
      progression: {
        memberId: "member-1",
        welfarePoints: 6,
        benefitPercentage: 25,
        membershipStatus: "ACTIVE",
        isMature: true,
        eligibleToClaim: true,
        successfulContributionMonths: 6,
        consecutiveContributionMonths: 6,
        consecutiveMissedMonths: 0,
        outstandingContributionMonths: 0,
        outstandingMonths: [],
        maturityDate: null,
        lastSuccessfulContributionDate: null,
        lastCalculatedAt: "2026-07-26T10:00:00.000Z",
      },
    });

    await submitClaimDraft("claim-1", memberActor as never);
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    const history = payload.auditHistory as Array<{ type: string }>;
    expect(history.map((event) => event.type)).toContain("CLAIM_CREATED");
    expect(history.map((event) => event.type)).toContain("CLAIM_SUBMITTED");
  });
});
