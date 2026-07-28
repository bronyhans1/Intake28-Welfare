import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClaimStatus,
  PaymentCategory,
  PaymentMethod,
  PaymentType,
  UserRole,
} from "@/types/enums";
import { ClaimsAuditAction } from "@/lib/claims/audit";
import {
  appendClaimLifecycleAuditHistory,
  ClaimLifecycleAuditType,
} from "@/lib/claims/claim-lifecycle-audit";
import {
  canProcessClaimPayments,
  canStartClaimPaymentProcessing,
  canCompleteClaimPayment,
} from "@/lib/claims/claim-access";
import {
  assertClaimPaymentAmountAllowed,
  resolveApprovedBenefitAmount,
} from "@/lib/claims/claim-benefit-amount";
import { claimAuditHistoryToTimelineEvents } from "@/lib/claims/claim-timeline-adapter";
import { resolvePaymentCategory } from "@/lib/payments/payment-category";
import { Permission, hasPermission } from "@/lib/auth/permissions";
import { resolveTimelineEventTitle } from "@/components/timeline/event-config";
import { ClaimAmountMode } from "@/types/enums";

const mockCreateAuditLog = vi.fn();
const mockUpdate = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();
const mockCreateClaimDisbursementPayment = vi.fn();
const mockGetMemberById = vi.fn();
const mockGetSystemSettings = vi.fn();

vi.mock("@/lib/audit/repository", () => ({
  createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
}));

vi.mock("@/lib/firestore/sanitize", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/firestore/sanitize")
  >("@/lib/firestore/sanitize");
  return {
    ...actual,
    warnInvalidFirestorePayload: vi.fn(),
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
  }),
}));

vi.mock("@/lib/claims/claim-type-repository", () => ({
  getClaimTypeConfigByCode: vi.fn(async () => ({
    code: "medical",
    displayName: "Medical",
    amountMode: ClaimAmountMode.FIXED,
    fixedAmount: 750,
  })),
}));

vi.mock("@/lib/payments/repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/payments/repository")
  >("@/lib/payments/repository");
  return {
    ...actual,
    createClaimDisbursementPayment: (...args: unknown[]) =>
      mockCreateClaimDisbursementPayment(...args),
  };
});

vi.mock("@/lib/members/repository", () => ({
  getMemberById: (...args: unknown[]) => mockGetMemberById(...args),
}));

vi.mock("@/lib/system-settings/repository", () => ({
  getSystemSettings: (...args: unknown[]) => mockGetSystemSettings(...args),
}));

vi.mock("@/lib/payments/member-email", () => ({
  deriveMemberPaymentEmailAddress: () => "member@example.com",
}));

vi.mock("@/lib/claims/eligibility-service", () => ({
  evaluateMemberEligibilityForClaim: vi.fn(),
}));

const {
  approveClaim,
} = await import("@/lib/claims/claim-executive-review");

const {
  startClaimPaymentProcessing,
  completeClaimPayment,
} = await import("@/lib/claims/claim-finance");

const executiveActor = {
  uid: "exec-1",
  fullName: "Executive User",
  role: UserRole.TREASURER,
  serviceNumber: "IS/2",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const memberActor = {
  uid: "member-1",
  fullName: "Member User",
  role: UserRole.MEMBER,
  serviceNumber: "IS/13984",
  profileCompleted: true,
  profileCompletionPercentage: 100,
};

const submittedData = {
  reference: "GIS-2026-00020",
  claimNumber: "GIS-2026-00020",
  memberId: "member-1",
  memberName: "Member User",
  serviceNumber: "IS/13984",
  claimTypeCode: "medical",
  claimTypeDisplayName: "Medical",
  status: ClaimStatus.SUBMITTED,
  title: "Hospital visit",
  description: "Surgery support",
  incidentDate: "2026-07-01",
  submittedAt: "2026-07-10T12:00:00.000Z",
  auditHistory: [
    {
      id: "cae_1",
      type: ClaimLifecycleAuditType.CLAIM_SUBMITTED,
      title: "Claim Submitted",
      performedByUserId: "member-1",
      performedByName: "Member User",
      performedByRole: UserRole.MEMBER,
      createdAt: "2026-07-10T12:00:00.000Z",
      reason: null,
      metadata: {},
    },
  ],
  executiveComments: [],
  currency: "GHS",
  recommendedAmount: 750,
  claimCeiling: 1000,
  progressionSnapshot: {
    welfarePoints: 24,
    benefitPercentage: 75,
    membershipStatus: "ACTIVE",
    isMature: true,
    eligibleToClaim: true,
    recommendedAmount: 750,
    claimCeiling: 1000,
    calculatedAt: "2026-07-10T12:00:00.000Z",
  },
  createdBy: "member-1",
  createdByName: "Member User",
  createdAt: { seconds: 1, nanoseconds: 0 },
  updatedAt: { seconds: 1, nanoseconds: 0 },
};

function mockClaimDoc(data: Record<string, unknown>) {
  mockGet.mockResolvedValue({
    exists: true,
    id: "claim-1",
    data: () => ({ ...data }),
  });
}

describe("Phase 6 payment category model", () => {
  it("maps payment types to ledger categories", () => {
    expect(resolvePaymentCategory(PaymentType.MONTHLY_DUES)).toBe(
      PaymentCategory.CONTRIBUTION,
    );
    expect(resolvePaymentCategory(PaymentType.SPECIAL_CONTRIBUTION)).toBe(
      PaymentCategory.SPECIAL_CONTRIBUTION,
    );
    expect(resolvePaymentCategory(PaymentType.CLAIM_PAYMENT)).toBe(
      PaymentCategory.CLAIM,
    );
  });

  it("supports Claim category without duplicating payment data on claims", () => {
    expect(PaymentCategory.CLAIM).toBe("claim");
    expect(PaymentType.CLAIM_PAYMENT).toBe("claim_payment");
  });
});

describe("Phase 6 finance permissions", () => {
  it("allows only admin and treasurer to process claim payments", () => {
    expect(
      hasPermission(UserRole.ADMIN, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.TREASURER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(true);
    expect(
      hasPermission(UserRole.MEMBER, Permission.PROCESS_CLAIM_PAYMENTS),
    ).toBe(false);
    expect(canProcessClaimPayments(UserRole.MEMBER)).toBe(false);
  });
});

describe("Phase 6 benefit amount rules", () => {
  it("resolves approved benefit from claim type fixed amount", () => {
    expect(
      resolveApprovedBenefitAmount(
        { requestedAmount: null, claimTypeCode: "medical" },
        {
          amountMode: ClaimAmountMode.FIXED,
          fixedAmount: 750,
          displayName: "Medical",
        },
      ),
    ).toBe(750);
  });

  it("rejects payment above approved amount and requires reduction reason", () => {
    expect(() =>
      assertClaimPaymentAmountAllowed({
        approvedBenefitAmount: 750,
        paymentAmount: 800,
      }),
    ).toThrow(/cannot exceed/i);

    expect(() =>
      assertClaimPaymentAmountAllowed({
        approvedBenefitAmount: 750,
        paymentAmount: 500,
      }),
    ).toThrow(/explanation is required/i);

    expect(() =>
      assertClaimPaymentAmountAllowed({
        approvedBenefitAmount: 750,
        paymentAmount: 500,
        reductionReason: "Partial support only",
      }),
    ).not.toThrow();
  });
});

describe("Phase 6 finance workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
      set: mockSet,
      id: "payment-1",
    });
    mockCollection.mockReturnValue({ doc: mockDoc });
    mockUpdate.mockResolvedValue(undefined);
    mockCreateAuditLog.mockResolvedValue(undefined);
    mockGetSystemSettings.mockResolvedValue({ currency: "GHS" });
    mockGetMemberById.mockResolvedValue({
      id: "member-1",
      fullName: "Member User",
      serviceNumber: "IS/13984",
      email: "member@example.com",
    });
    mockCreateClaimDisbursementPayment.mockResolvedValue({
      id: "payment-1",
      reference: "GIS-20260725-ABCDEF",
      amount: 750,
      paymentCategory: PaymentCategory.CLAIM,
      paymentType: PaymentType.CLAIM_PAYMENT,
      claimId: "claim-1",
      claimNumber: "GIS-2026-00020",
    });
  });

  it("moves approved claims to Awaiting Payment with finance audit events", async () => {
    mockClaimDoc(submittedData);
    await approveClaim(
      "claim-1",
      { decision: "recommended" },
      executiveActor as never,
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe(ClaimStatus.AWAITING_PAYMENT);
    expect(payload.approvedBenefitAmount).toBe(750);
    expect(payload.finalAmount).toBe(750);
    const history = payload.auditHistory as Array<{ type: string }>;
    expect(
      history.some((e) => e.type === ClaimLifecycleAuditType.CLAIM_APPROVED),
    ).toBe(true);
    expect(
      history.some(
        (e) => e.type === ClaimLifecycleAuditType.CLAIM_SENT_TO_FINANCE,
      ),
    ).toBe(true);
    expect(mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: ClaimsAuditAction.CLAIM_SENT_TO_FINANCE,
      }),
    );
  });

  it("allows finance to start payment processing", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.AWAITING_PAYMENT,
      approvedBenefitAmount: 750,
    });

    await startClaimPaymentProcessing("claim-1", executiveActor as never);
    expect(mockUpdate.mock.calls[0][0].status).toBe(
      ClaimStatus.PAYMENT_PROCESSING,
    );
    expect(canStartClaimPaymentProcessing(ClaimStatus.AWAITING_PAYMENT)).toBe(
      true,
    );
  });

  it("blocks executives without finance permission and members from processing", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.AWAITING_PAYMENT,
      approvedBenefitAmount: 750,
    });

    await expect(
      startClaimPaymentProcessing("claim-1", memberActor as never),
    ).rejects.toThrow(/permission/i);

    await expect(
      completeClaimPayment(
        "claim-1",
        {
          amount: 750,
          paymentDate: "2026-07-20",
          paymentMethod: PaymentMethod.MOBILE_MONEY,
          referenceNumber: null,
          financeNotes: null,
          amountReductionReason: null,
        },
        memberActor as never,
      ),
    ).rejects.toThrow(/permission/i);
  });

  it("creates a Payments ledger record and stores only paymentId on the claim", async () => {
    mockClaimDoc({
      ...submittedData,
      status: ClaimStatus.PAYMENT_PROCESSING,
      approvedBenefitAmount: 750,
      paymentId: null,
    });

    const result = await completeClaimPayment(
      "claim-1",
      {
        amount: 700,
        paymentDate: "2026-07-20",
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNumber: "BANK-123",
        financeNotes: "Internal only",
        amountReductionReason: "Adjusted after review",
      },
      executiveActor as never,
    );

    expect(result.paymentId).toBe("payment-1");
    expect(mockCreateClaimDisbursementPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: "claim-1",
        claimNumber: "GIS-2026-00020",
        amount: 700,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        financeNotes: "Internal only",
        amountReductionReason: "Adjusted after review",
      }),
    );

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.status).toBe(ClaimStatus.PAID);
    expect(payload.paymentId).toBe("payment-1");
    expect(payload.amount).toBeUndefined();
    expect(payload.paymentMethod).toBeUndefined();
    expect(canCompleteClaimPayment(ClaimStatus.PAYMENT_PROCESSING)).toBe(true);
  });

  it("maps finance audit events for ActivityTimeline and keeps history append-only", () => {
    const first = {
      id: "cae_1",
      type: ClaimLifecycleAuditType.CLAIM_APPROVED,
      title: "Claim Approved",
      performedByUserId: "exec-1",
      performedByName: "Executive User",
      performedByRole: UserRole.TREASURER,
      createdAt: "2026-07-11T09:00:00.000Z",
      reason: null,
      metadata: {},
    };
    const second = {
      id: "cae_2",
      type: ClaimLifecycleAuditType.CLAIM_SENT_TO_FINANCE,
      title: "Sent to Finance",
      performedByUserId: "exec-1",
      performedByName: "Executive User",
      performedByRole: UserRole.TREASURER,
      createdAt: "2026-07-11T09:00:01.000Z",
      reason: null,
      metadata: {},
    };
    const third = {
      id: "cae_3",
      type: ClaimLifecycleAuditType.CLAIM_PAID,
      title: "Claim Paid",
      performedByUserId: "exec-1",
      performedByName: "Executive User",
      performedByRole: UserRole.TREASURER,
      createdAt: "2026-07-12T09:00:00.000Z",
      reason: null,
      metadata: {},
    };

    const history = appendClaimLifecycleAuditHistory(
      appendClaimLifecycleAuditHistory([first], second),
      third,
    );
    expect(history).toHaveLength(3);
    const timeline = claimAuditHistoryToTimelineEvents(history);
    expect(resolveTimelineEventTitle(timeline[1])).toBe("Sent to Finance");
    expect(resolveTimelineEventTitle(timeline[2])).toBe("Claim Paid");
  });
});
