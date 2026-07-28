import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { createAuditLog } from "@/lib/audit/repository";
import { buildAuditActor } from "@/lib/audit/actor";
import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { sanitizeFirestoreData, warnInvalidFirestorePayload } from "@/lib/firestore/sanitize";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { PaymentAuditAction } from "@/lib/payments/audit";
import {
  deriveMemberPaymentEmailAddress,
  isPaystackCompatibleEmail,
} from "@/lib/payments/member-email";
import { resolvePaymentCategory } from "@/lib/payments/payment-category";
import { generatePaymentReference } from "@/lib/payments/reference";
import {
  paystackInitializeTransaction,
  paystackVerifyTransaction,
} from "@/lib/integrations/paystack/client";
import { ensureContributionFromPayment } from "@/lib/payments/contribution-automation";
import { abandonStalePendingPayments } from "@/lib/payments/lifecycle";
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

  const records = await fetchAllRecords();
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

  const amount = resolveInitializePaymentAmount(
    input.paymentType,
    input.amount,
    settings.monthlyDuesAmount,
    selectedMonths.length || 1,
  );
  const reference = generatePaymentReference();
  const email = deriveMemberPaymentEmailAddress(member);
  if (!isPaystackCompatibleEmail(email)) {
    throw new Error(
      `Payment email "${email}" is not compatible with Paystack. Set PAYMENT_EMAIL_DOMAIN to a valid domain.`,
    );
  }

  const callbackUrl = `${env.client().NEXT_PUBLIC_APP_URL}/payments?reference=${encodeURIComponent(reference)}`;

  await createPayment({
    memberId: member.id,
    memberName: member.fullName,
    serviceNumber: member.serviceNumber,
    email,
    amount,
    currency: settings.currency,
    reference,
    paymentType: input.paymentType,
    paymentCategory: resolvePaymentCategory(input.paymentType),
    provider: PaymentProvider.PAYSTACK,
    providerReference: null,
    status: PaymentStatus.PENDING,
    selectedMonths:
      selectedMonths.length > 0 ? selectedMonths : null,
  });

  const { authorizationUrl } = await paystackInitializeTransaction({
    email,
    amount,
    reference,
    currency: settings.currency,
    callbackUrl,
    metadata: {
      memberId: member.id,
      paymentType: input.paymentType,
      paymentCategory: resolvePaymentCategory(input.paymentType),
      selectedMonths: selectedMonths.map((period) => formatMonthYearLabel(period)),
      amount,
    },
  });

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
      currency: settings.currency,
      paymentType: input.paymentType,
      paymentCategory: resolvePaymentCategory(input.paymentType),
      reference,
      selectedMonths,
    },
  });

  return { reference, authorizationUrl };
}

export async function verifyPayment(
  reference: string,
  actor: CurrentUser,
): Promise<SerializedPayment> {
  const payment = await getPaymentByReference(reference);
  if (!payment) {
    throw new Error("Payment not found.");
  }

  await abandonStalePendingPayments();

  if (actor.role === UserRole.MEMBER && payment.memberId !== actor.uid) {
    throw new Error("You do not have permission to verify this payment.");
  }

  const canVerifyPayment =
    (actor.role === UserRole.MEMBER && canInitializePayments(actor.role)) ||
    canViewPayments(actor.role);

  if (!canVerifyPayment) {
    throw new Error("You do not have permission to verify payments.");
  }

  const verification = await paystackVerifyTransaction(reference);
  const updated = await updatePaymentStatus(reference, {
    status: verification.status,
    providerReference: verification.providerReference,
    paidAt: verification.paidAt,
  });

  await createAuditLog({
    action: PaymentAuditAction.PAYMENT_VERIFIED,
    entityType: "payment",
    entityId: reference,
    ...buildAuditActor(actor),
    metadata: {
      memberId: payment.memberId,
      memberName: payment.memberName,
      serviceNumber: payment.serviceNumber,
      amount: payment.amount,
      currency: payment.currency,
      reference,
      status: verification.status,
      providerReference: verification.providerReference,
    },
  });

  if (updated.status === PaymentStatus.SUCCESS) {
    const paymentForAutomation: SerializedPayment = {
      ...payment,
      status: updated.status,
      providerReference: updated.providerReference,
      paidAt: updated.paidAt,
      updatedAt: updated.updatedAt,
    };

    await ensureContributionFromPayment(paymentForAutomation, actor);
  }

  return updated;
}
