import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContributionSource,
  ContributionStatus,
  ContributionType,
} from "@/types/enums";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockGet = vi.fn();
const mockRunTransaction = vi.fn();
const mockRecalculateMembershipProgression = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (...args: unknown[]) => mockCollection(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  }),
}));

vi.mock("@/lib/progression", () => ({
  recalculateMembershipProgression: (...args: unknown[]) =>
    mockRecalculateMembershipProgression(...args),
}));

import {
  buildAutomatedContributionDocumentId,
  createAutomatedContribution,
} from "@/lib/contributions/repository";

const paymentReference = "GIS-20260824-HYXLXC";
const expectedDocumentId = "GIS-20260824-HYXLXC_2026-08";

const automatedInput = {
  memberId: "member-nicholas",
  memberName: "Nicholas Yaw Frimpong",
  serviceNumber: "IS/12957",
  contributionType: ContributionType.MONTHLY_DUES,
  amount: 50,
  month: 8,
  year: 2026,
  source: ContributionSource.PAYSTACK,
  paymentReference,
  paymentId: "payment-1",
  remarks: "Paid August 2026 contribution.",
};

function makeContributionData(overrides: Record<string, unknown> = {}) {
  return {
    memberId: automatedInput.memberId,
    memberName: automatedInput.memberName,
    serviceNumber: automatedInput.serviceNumber,
    contributionType: ContributionType.MONTHLY_DUES,
    amount: 50,
    month: 8,
    year: 2026,
    status: ContributionStatus.PAID,
    remarks: automatedInput.remarks,
    recordedBy: "paystack-automation",
    recordedByName: "Paystack Automation",
    contributionMonth: 8,
    contributionYear: 2026,
    source: ContributionSource.PAYSTACK,
    paymentReference,
    paymentId: "payment-1",
    createdAt: { seconds: 1, nanoseconds: 0 },
    updatedAt: { seconds: 1, nanoseconds: 0 },
    ...overrides,
  };
}

/**
 * Shared in-memory store with transaction retry semantics approximating
 * Firestore: concurrent create on the same id → one winner, loser retries
 * and observes the existing document.
 */
function installConcurrentSafeTransactionStore() {
  const store = new Map<string, Record<string, unknown>>();
  let createAttempts = 0;

  mockDoc.mockImplementation((id?: string) => {
    const docId = id ?? "random";
    return {
      id: docId,
      get: async () => {
        if (!store.has(docId)) {
          return { exists: false, id: docId, data: () => undefined };
        }
        return {
          exists: true,
          id: docId,
          data: () => store.get(docId),
        };
      },
    };
  });

  mockCollection.mockReturnValue({
    doc: mockDoc,
  });

  mockRunTransaction.mockImplementation(
    async (
      callback: (tx: {
        get: (ref: { id: string }) => Promise<{
          exists: boolean;
          id: string;
          data: () => Record<string, unknown> | undefined;
        }>;
        create: (ref: { id: string }, data: Record<string, unknown>) => void;
      }) => Promise<boolean>,
    ) => {
      // Retry like Firestore when a concurrent create races.
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          return await callback({
            get: async (ref) => {
              if (!store.has(ref.id)) {
                return { exists: false, id: ref.id, data: () => undefined };
              }
              return {
                exists: true,
                id: ref.id,
                data: () => store.get(ref.id),
              };
            },
            create: (ref, data) => {
              createAttempts += 1;
              if (store.has(ref.id)) {
                const error = new Error("Document already exists");
                (error as Error & { code: number }).code = 6;
                throw error;
              }
              // Persist plain timestamps so serializeFirestoreDoc can read the doc.
              store.set(ref.id, {
                ...data,
                createdAt: { seconds: 1, nanoseconds: 0 },
                updatedAt: { seconds: 1, nanoseconds: 0 },
              });
            },
          });
        } catch (error) {
          const code = (error as { code?: number }).code;
          if (code === 6) {
            continue;
          }
          throw error;
        }
      }
      throw new Error("Transaction retries exhausted");
    },
  );

  return {
    store,
    getCreateAttempts: () => createAttempts,
  };
}

describe("buildAutomatedContributionDocumentId", () => {
  it("derives a deterministic id from payment reference and period", () => {
    expect(buildAutomatedContributionDocumentId(paymentReference, 8, 2026)).toBe(
      expectedDocumentId,
    );
    expect(buildAutomatedContributionDocumentId("GIS-1", 1, 2026)).toBe(
      "GIS-1_2026-01",
    );
  });
});

describe("createAutomatedContribution atomic idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecalculateMembershipProgression.mockResolvedValue(undefined);
  });

  it("uses payment reference + month/year as the contribution document id", async () => {
    const { store } = installConcurrentSafeTransactionStore();

    const result = await createAutomatedContribution(automatedInput);

    expect(mockDoc).toHaveBeenCalledWith(expectedDocumentId);
    expect(result.created).toBe(true);
    expect(result.contribution.id).toBe(expectedDocumentId);
    expect(store.size).toBe(1);
    expect(mockRecalculateMembershipProgression).toHaveBeenCalledTimes(1);
  });

  it("returns existing contribution without creating a duplicate on repeat call", async () => {
    const { store } = installConcurrentSafeTransactionStore();
    store.set(expectedDocumentId, makeContributionData());

    mockGet.mockResolvedValue({
      exists: true,
      id: expectedDocumentId,
      data: () => makeContributionData(),
    });
    mockDoc.mockImplementation((id?: string) => ({
      id: id ?? expectedDocumentId,
      get: async () => ({
        exists: true,
        id: expectedDocumentId,
        data: () => makeContributionData(),
      }),
    }));
    mockCollection.mockReturnValue({ doc: mockDoc });

    const result = await createAutomatedContribution(automatedInput);

    expect(result.created).toBe(false);
    expect(result.contribution.id).toBe(expectedDocumentId);
    expect(mockRunTransaction).not.toHaveBeenCalled();
    expect(mockRecalculateMembershipProgression).not.toHaveBeenCalled();
    expect(store.size).toBe(1);
  });

  it("concurrent creates for the same payment produce exactly one contribution", async () => {
    const { store, getCreateAttempts } = installConcurrentSafeTransactionStore();

    // Force both callers past the pre-transaction existence check together.
    let releasePrecheck: (() => void) | undefined;
    const precheckGate = new Promise<void>((resolve) => {
      releasePrecheck = resolve;
    });
    let precheckWaiters = 0;

    mockDoc.mockImplementation((id?: string) => {
      const docId = id ?? "random";
      return {
        id: docId,
        get: async () => {
          if (!store.has(docId)) {
            precheckWaiters += 1;
            if (precheckWaiters >= 2) {
              releasePrecheck?.();
            }
            await precheckGate;
            return { exists: false, id: docId, data: () => undefined };
          }
          return {
            exists: true,
            id: docId,
            data: () => store.get(docId),
          };
        },
      };
    });

    mockCollection.mockReturnValue({ doc: mockDoc });

    const [first, second] = await Promise.all([
      createAutomatedContribution(automatedInput),
      createAutomatedContribution(automatedInput),
    ]);

    expect(store.size).toBe(1);
    expect(store.has(expectedDocumentId)).toBe(true);

    const createdFlags = [first.created, second.created].sort();
    expect(createdFlags).toEqual([false, true]);

    expect(first.contribution.id).toBe(expectedDocumentId);
    expect(second.contribution.id).toBe(expectedDocumentId);
    expect(first.contribution.paymentReference).toBe(paymentReference);
    expect(second.contribution.paymentReference).toBe(paymentReference);
    expect(getCreateAttempts()).toBeGreaterThanOrEqual(1);
    expect(mockRecalculateMembershipProgression).toHaveBeenCalledTimes(1);
  });
});
