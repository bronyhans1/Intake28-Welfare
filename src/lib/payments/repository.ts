import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { deriveMemberPaymentEmailAddress } from "@/lib/payments/member-email";
import { resolvePaymentCategory } from "@/lib/payments/payment-category";
import { generatePaymentReference } from "@/lib/payments/reference";
import {
  HUBTEL_CLIENT_REFERENCE_MAX_LENGTH,
  hubtelInitiateCheckout,
} from "@/lib/integrations/hubtel/checkout";
import { abandonStalePendingPayments } from "@/lib/payments/lifecycle";
import {
  PaymentSettlementError,
  settlePaymentByReference,
} from "@/lib/payments/settlement";
import {
  assertMonthlyDuesPaymentAllowed,
  normalizeSelectedMonths,
} from "@/lib/payments/monthly-dues-guard";
import {
  assertMonthsWithinContributionWindow,
  getMemberOutstandingContributions,
  resolveContributionStartMonth,
} from "@/lib/contributions/outstanding-months";
import { getMemberById } from "@/lib/members/repository";
import { getSystemSettings } from "@/lib/system-settings/repository";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { env } from "@/config/env";
import { assertPaymentsEnabled } from "@/lib/payments/availability";
import { resolveCheckoutAmountBreakdown } from "@/lib/payments/checkout-amount";
import { resolveInitializePaymentAmount } from "@/lib/payments/resolve-amount";
import { formatMonthYearLabel, getCurrentMonthYear } from "@/lib/finance/period";
import {
  PaymentCategory,
  PaymentProvider,
  PaymentStatus,
  PaymentType,
  UserRole,
} from "@/types/enums";
import type { CurrentUser } from "@/types/auth";
import type {
  CreateClaimDisbursementPaymentInput,
  InitializePaymentInput,
  InitializePaymentResult,
  MemberVisiblePaymentSummary,
  Payment,
  SerializedPayment,
} from "@/types/payment";
import type { PaymentListQuery } from "@/lib/validators/payments";

function mapFirestoreDoc(id: string, data: Record<string, unknown>): Payment {
  return { id, ...data } as Payment;
}

function serializeRecord(record: Payment): SerializedPayment {
  const { id, ...rest } = record;
  return serializeFirestoreDoc<SerializedPayment>(id, rest as Record<string, unknown>);
}

export interface PaymentListResult {
  records: SerializedPayment[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function canViewPayments(role: UserRole): boolean {
  return hasPermission(role, Permission.VIEW_PAYMENTS);
}

export function canInitializePayments(role: UserRole): boolean {
  return hasPermission(role, Permission.MAKE_PAYMENTS);
}

async function fetchAllRecords(): Promise<Payment[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

function paymentCreatedAtMs(record: Payment): number {
  const value = record.createdAt as unknown;
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

/** Member-scoped payments read — equality filter only (no composite index). */
async function fetchRecordsByMemberId(memberId: string): Promise<Payment[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("memberId", "==", memberId)
    .get();

  return snapshot.docs
    .map((doc) => mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>))
    .sort((left, right) => paymentCreatedAtMs(right) - paymentCreatedAtMs(left));
}

async function fetchPaymentRecords(options?: {
  memberId?: string;
}): Promise<Payment[]> {
  if (options?.memberId) {
    return fetchRecordsByMemberId(options.memberId);
  }
  return fetchAllRecords();
}

export async function createPayment(
  input: Omit<Payment, "id" | "createdAt" | "updatedAt" | "paidAt">,
): Promise<SerializedPayment> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.PAYMENTS).doc();

  const paymentCategory =
    input.paymentCategory ??
    resolvePaymentCategory(input.paymentType, null);

  const document = sanitizeFirestoreData({
    ...input,
    paymentCategory,
    paidAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createPayment", document);
  await ref.set(document);

  const created = await ref.get();
  return serializeRecord(
    mapFirestoreDoc(created.id, created.data() as Record<string, unknown>),
  );
}

/** Manual claim disbursement — creates a SUCCESS ledger row (source of truth). */
export async function createClaimDisbursementPayment(
  input: CreateClaimDisbursementPaymentInput,
): Promise<SerializedPayment> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.PAYMENTS).doc();

  const document = sanitizeFirestoreData({
    memberId: input.memberId,
    memberName: input.memberName,
    serviceNumber: input.serviceNumber,
    email: input.email,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    paymentType: PaymentType.CLAIM_PAYMENT,
    paymentCategory: PaymentCategory.CLAIM,
    provider: PaymentProvider.MANUAL,
    providerReference: null,
    status: PaymentStatus.SUCCESS,
    paymentMethod: input.paymentMethod,
    claimId: input.claimId,
    claimNumber: input.claimNumber,
    claimTypeCode: input.claimTypeCode,
    claimTypeDisplayName: input.claimTypeDisplayName,
    paidById: input.paidById,
    paidByName: input.paidByName,
    financeNotes: input.financeNotes ?? null,
    amountReductionReason: input.amountReductionReason ?? null,
    paidAt: Timestamp.fromDate(input.paymentDate),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("createClaimDisbursementPayment", document);
  await ref.set(document);

  const created = await ref.get();
  return serializeRecord(
    mapFirestoreDoc(created.id, created.data() as Record<string, unknown>),
  );
}

export async function getPaymentById(
  paymentId: string,
): Promise<SerializedPayment | null> {
  const db = getAdminDb();
  const doc = await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).get();
  if (!doc.exists) return null;
  return serializeRecord(
    mapFirestoreDoc(doc.id, doc.data() as Record<string, unknown>),
  );
}

/** Member-safe view of a payment (excludes financeNotes). */
export function toMemberVisiblePaymentSummary(
  payment: SerializedPayment,
): MemberVisiblePaymentSummary {
  return {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod ?? null,
    paidAt: payment.paidAt,
    reference: payment.reference,
    status: payment.status,
  };
}

export async function updatePaymentStatus(
  reference: string,
  updates: {
    status: PaymentStatus;
    providerReference?: string | null;
    paidAt?: Date | null;
  },
): Promise<SerializedPayment> {
  const payment = await getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found.");
  }

  if (
    payment.status === PaymentStatus.SUCCESS &&
    updates.status !== PaymentStatus.SUCCESS
  ) {
    return payment;
  }

  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.PAYMENTS).doc(payment.id);

  const document = sanitizeFirestoreData({
    status: updates.status,
    providerReference: updates.providerReference ?? payment.providerReference,
    paidAt:
      updates.paidAt != null
        ? Timestamp.fromDate(updates.paidAt)
        : updates.status === PaymentStatus.SUCCESS
          ? Timestamp.fromDate(new Date())
          : null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  warnInvalidFirestorePayload("updatePaymentStatus", document);
  await ref.update(document);

  const updated = await getPaymentByReference(reference);
  if (!updated) {
    throw new Error("Payment not found after update.");
  }

  return updated;
}

export type ClaimPaymentSuccessResult =
  | { outcome: "claimed"; payment: SerializedPayment }
  | { outcome: "already_settled"; payment: SerializedPayment };

/**
 * Atomically claim SUCCESS settlement for a payment.
 * Only PENDING or ABANDONED (historical recovery) may transition.
 * Concurrent callers: exactly one receives "claimed"; others "already_settled".
 */
export async function claimPaymentSuccessTransition(
  reference: string,
  updates: {
    providerReference?: string | null;
    paidAt?: Date | null;
  } = {},
): Promise<ClaimPaymentSuccessResult> {
  const existing = await getPaymentByReference(reference);
  if (!existing) {
    throw new Error("Payment not found.");
  }

  const db = getAdminDb();
  const docRef = db.collection(COLLECTIONS.PAYMENTS).doc(existing.id);

  const claimOutcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) {
      throw new Error("Payment not found.");
    }

    const data = snapshot.data() as Record<string, unknown>;
    const status = String(data.status ?? "");

    if (status === PaymentStatus.SUCCESS) {
      return "already_settled" as const;
    }

    if (
      status !== PaymentStatus.PENDING &&
      status !== PaymentStatus.ABANDONED
    ) {
      throw new Error(
        `Payment status ${status} cannot be settled as successful.`,
      );
    }

    const document = sanitizeFirestoreData({
      status: PaymentStatus.SUCCESS,
      providerReference:
        updates.providerReference ?? (data.providerReference as string | null) ?? null,
      paidAt:
        updates.paidAt != null
          ? Timestamp.fromDate(updates.paidAt)
          : Timestamp.fromDate(new Date()),
      updatedAt: FieldValue.serverTimestamp(),
    });

    warnInvalidFirestorePayload("claimPaymentSuccessTransition", document);
    transaction.update(docRef, document);
    return "claimed" as const;
  });

  const payment = await getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found after settlement claim.");
  }

  return { outcome: claimOutcome, payment };
}

/**
 * Atomically mark a PENDING payment FAILED (Hubtel Refunded/Failed).
 * No-op style: if already SUCCESS, leave SUCCESS untouched.
 */
export async function claimPaymentFailedTransition(
  reference: string,
  updates: {
    providerReference?: string | null;
  } = {},
): Promise<SerializedPayment> {
  const existing = await getPaymentByReference(reference);
  if (!existing) {
    throw new Error("Payment not found.");
  }

  const db = getAdminDb();
  const docRef = db.collection(COLLECTIONS.PAYMENTS).doc(existing.id);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(docRef);
    if (!snapshot.exists) {
      throw new Error("Payment not found.");
    }

    const data = snapshot.data() as Record<string, unknown>;
    const status = String(data.status ?? "");

    if (status === PaymentStatus.SUCCESS || status === PaymentStatus.FAILED) {
      return;
    }

    if (status !== PaymentStatus.PENDING) {
      return;
    }

    const document = sanitizeFirestoreData({
      status: PaymentStatus.FAILED,
      providerReference:
        updates.providerReference ?? (data.providerReference as string | null) ?? null,
      paidAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    warnInvalidFirestorePayload("claimPaymentFailedTransition", document);
    transaction.update(docRef, document);
  });

  const payment = await getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found after failed-status claim.");
  }
  return payment;
}

/**
 * One ordered payments read for a single report.
 * The first document for a reference wins, matching getPaymentByReference.
 */
export async function loadPaymentsByReference(): Promise<Map<string, SerializedPayment>> {
  const records = await fetchAllRecords();
  const byReference = new Map<string, SerializedPayment>();

  for (const record of records) {
    if (!record.reference || byReference.has(record.reference)) continue;
    byReference.set(record.reference, serializeRecord(record));
  }

  return byReference;
}

export async function getPaymentByReference(
  reference: string,
): Promise<SerializedPayment | null> {
  const records = await fetchAllRecords();
  const record = records.find((item) => item.reference === reference);
  return record ? serializeRecord(record) : null;
}

export async function listPayments(
  query: PaymentListQuery,
  actor: CurrentUser,
): Promise<PaymentListResult> {
  await abandonStalePendingPayments();

  const scopedMemberId =
    actor.role === UserRole.MEMBER
      ? actor.uid
      : query.memberId;

  const records = await fetchPaymentRecords(
    scopedMemberId ? { memberId: scopedMemberId } : undefined,
  );
  const scopedRecords =
    actor.role === UserRole.MEMBER
      ? records.filter((record) => record.memberId === actor.uid)
      : canViewPayments(actor.role)
        ? records
        : [];

  const filtered = scopedRecords.filter((record) => {
    if (
      actor.role === UserRole.MEMBER &&
      !query.status &&
      record.status === PaymentStatus.ABANDONED
    ) {
      return false;
    }

    if (query.memberId && record.memberId !== query.memberId) return false;
    if (query.status && record.status !== query.status) return false;
    if (query.paymentType && record.paymentType !== query.paymentType) {
      return false;
    }

    const category = resolvePaymentCategory(
      record.paymentType,
      record.paymentCategory,
    );
    if (query.paymentCategory && category !== query.paymentCategory) {
      return false;
    }
    if (
      query.paymentMethod &&
      (record.paymentMethod ?? "") !== query.paymentMethod
    ) {
      return false;
    }

    if (query.search) {
      const search = query.search.toLowerCase();
      const matchesReference = record.reference.toLowerCase().includes(search);
      const matchesMember = record.memberName.toLowerCase().includes(search);
      const matchesService = record.serviceNumber.toLowerCase().includes(search);
      const matchesClaim = (record.claimNumber ?? "")
        .toLowerCase()
        .includes(search);
      if (
        !matchesReference &&
        !matchesMember &&
        !matchesService &&
        !matchesClaim
      ) {
        return false;
      }
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    records: filtered.slice(start, start + query.pageSize).map(serializeRecord),
    total,
    page,
    pageSize: query.pageSize,
    totalPages,
  };
}

export async function initializePayment(
  input: InitializePaymentInput,
  actor: CurrentUser,
): Promise<InitializePaymentResult> {
  assertPaymentsEnabled();

  if (!canInitializePayments(actor.role)) {
    throw new Error("You do not have permission to initialize payments.");
  }

  if (actor.uid !== input.memberId) {
    throw new Error("You can only initialize payments for your own account.");
  }

  const member = await getMemberById(input.memberId);
  if (!member) {
    throw new Error("Member not found.");
  }

  await assertMonthlyDuesPaymentAllowed(
    input.memberId,
    input.paymentType,
    input.selectedMonths,
  );

  const settings = await getSystemSettings();
  const selectedMonths =
    input.paymentType === PaymentType.MONTHLY_DUES
      ? normalizeSelectedMonths(input.selectedMonths ?? [])
      : [];

  if (input.paymentType === PaymentType.MONTHLY_DUES) {
    if (selectedMonths.length === 0) {
      throw new Error("Select at least one contribution month.");
    }

    const membershipStart =
      resolveContributionStartMonth(member) ?? getCurrentMonthYear();
    const currentMonth = getCurrentMonthYear();
    assertMonthsWithinContributionWindow({
      selectedMonths,
      membershipStart,
      currentMonth,
    });

    const outstanding = await getMemberOutstandingContributions(member.id);
    const outstandingKeys = new Set(
      outstanding.outstanding.map(
        (item) => `${item.year}-${String(item.month).padStart(2, "0")}`,
      ),
    );
    for (const period of selectedMonths) {
      const key = `${period.year}-${String(period.month).padStart(2, "0")}`;
      if (!outstandingKeys.has(key)) {
        throw new Error(
          `${formatMonthYearLabel(period)} is not an unpaid contribution month.`,
        );
      }
    }
  }

  const officialAmount = resolveInitializePaymentAmount(
    input.paymentType,
    input.amount,
    settings.monthlyDuesAmount,
    selectedMonths.length || 1,
  );
  const {
    amount,
    checkoutAmount,
    processingFeeAmount,
  } = resolveCheckoutAmountBreakdown(officialAmount);
  const reference = generatePaymentReference();
  if (reference.length > HUBTEL_CLIENT_REFERENCE_MAX_LENGTH) {
    throw new Error("Generated payment reference exceeds provider limits.");
  }

  const email = deriveMemberPaymentEmailAddress(member);
  const appUrl = env.client().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const callbackUrl = `${appUrl}/api/payments/callback?reference=${encodeURIComponent(reference)}`;
  const returnUrl = `${appUrl}/payments?reference=${encodeURIComponent(reference)}`;
  const cancellationUrl = `${appUrl}/portal/contributions?cancelled=1`;
  const paymentCategory = resolvePaymentCategory(input.paymentType);
  const description =
    input.paymentType === PaymentType.MONTHLY_DUES
      ? `Monthly dues (${selectedMonths.map((period) => formatMonthYearLabel(period)).join(", ")})`
      : `Welfare payment (${input.paymentType})`;

  await createPayment({
    memberId: member.id,
    memberName: member.fullName,
    serviceNumber: member.serviceNumber,
    email,
    amount,
    checkoutAmount,
    processingFeeAmount,
    currency: settings.currency,
    reference,
    paymentType: input.paymentType,
    paymentCategory,
    provider: PaymentProvider.HUBTEL,
    providerReference: null,
    status: PaymentStatus.PENDING,
    selectedMonths:
      selectedMonths.length > 0 ? selectedMonths : null,
  });

  let checkoutUrl: string;
  try {
    const initiated = await hubtelInitiateCheckout({
      totalAmount: checkoutAmount,
      description,
      callbackUrl,
      returnUrl,
      cancellationUrl,
      clientReference: reference,
    });
    checkoutUrl = initiated.checkoutUrl;
  } catch (error) {
    /**
     * Orphan-PENDING recovery (do not invent failure):
     * - Leave status PENDING. Hubtel may have accepted checkout despite a client timeout.
     * - Do not auto-retry initiate for the same reference.
     * - Member/admin should use Check status / callback verify later.
     * - Stale unresolved PENDING is abandoned after PAYMENT_ABANDONMENT_HOURS.
     * - If the member was never charged, finance may record a manual contribution
     *   after confirmation; do not create a second online payment for the same
     *   months until outstanding/paid guards allow it.
     */
    const message =
      error instanceof Error ? error.message : "Hubtel checkout initiation failed.";
    await createAuditLog({
      action: PaymentAuditAction.PAYMENT_INITIALIZED,
      entityType: "payment",
      entityId: reference,
      ...buildAuditActor(actor),
      metadata: {
        memberId: member.id,
        memberName: member.fullName,
        serviceNumber: member.serviceNumber,
        amount,
        checkoutAmount,
        processingFeeAmount,
        currency: settings.currency,
        paymentType: input.paymentType,
        paymentCategory,
        provider: PaymentProvider.HUBTEL,
        reference,
        selectedMonths,
        initiationOutcome: "failed",
        initiationError: message.slice(0, 240),
      },
    });
    throw new Error(
      `${message} A pending payment ${reference} was recorded. Check Payment History before trying again — do not assume the charge failed.`,
    );
  }

  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_INITIALIZED,
    entityType: "payment",
    entityId: reference,
    ...buildAuditActor(actor),
    metadata: {
      memberId: member.id,
      memberName: member.fullName,
      serviceNumber: member.serviceNumber,
      amount,
      checkoutAmount,
      processingFeeAmount,
      currency: settings.currency,
      paymentType: input.paymentType,
      paymentCategory,
      provider: PaymentProvider.HUBTEL,
      reference,
      selectedMonths,
      initiationOutcome: "started",
    },
  });

  // Keep authorizationUrl key for existing member UI redirect contract.
  return { reference, authorizationUrl: checkoutUrl };
}

export async function verifyPayment(
  reference: string,
  actor: CurrentUser,
): Promise<SerializedPayment> {
  const payment = await getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found.");
  }

  if (actor.role === UserRole.MEMBER && payment.memberId !== actor.uid) {
    throw new Error("You do not have permission to verify this payment.");
  }

  const canVerifyPayment =
    (actor.role === UserRole.MEMBER && canInitializePayments(actor.role)) ||
    canViewPayments(actor.role);

  if (!canVerifyPayment) {
    throw new Error("You do not have permission to verify payments.");
  }

  try {
    const result = await settlePaymentByReference(reference, {
      actor,
      source: "verify",
    });
    return result.payment;
  } catch (error) {
    if (error instanceof PaymentSettlementError) {
      throw new Error(error.message);
    }
    throw error;
  }
}
