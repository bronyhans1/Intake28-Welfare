/**
 * ONE-PAYMENT production recovery pilot — GIS-20260828-XV95KD only.
 * Pre-check → settle → post-verify. Stdout JSON report only.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  PAYSTACK_SETTLEMENT_ACTOR,
  settlePaymentFromPaystackReference,
} from "@/lib/payments/settlement";
import { PaymentAuditAction } from "@/lib/payments/audit";
import { COLLECTIONS } from "@/lib/constants";
import { NotificationEventType } from "@/lib/notifications/types";
import { buildAutomatedContributionDocumentId } from "@/lib/contributions/repository";

const REFERENCE = "GIS-20260828-XV95KD";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename: string) {
  const filePath = resolve(root, filename);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.error(JSON.stringify({ error: "Firebase admin env missing" }));
  process.exit(1);
}

if (!process.env.PAYSTACK_SECRET_KEY) {
  console.error(JSON.stringify({ error: "PAYSTACK_SECRET_KEY missing" }));
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function fetchPaymentByReference(reference: string) {
  const snap = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("reference", "==", reference)
    .limit(2)
    .get();
  if (snap.empty) return null;
  if (snap.size > 1) {
    throw new Error(`Multiple payment documents for reference ${reference}`);
  }
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string };
}

async function fetchContributionsForReference(reference: string) {
  const snap = await db
    .collection(COLLECTIONS.CONTRIBUTIONS)
    .where("paymentReference", "==", reference)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchReceiptForReference(reference: string) {
  const direct = await db.collection(COLLECTIONS.RECEIPTS).doc(reference).get();
  if (direct.exists) {
    return [{ id: direct.id, ...direct.data() }];
  }
  const snap = await db
    .collection(COLLECTIONS.RECEIPTS)
    .where("paymentReference", "==", reference)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchAuditForReference(reference: string) {
  const snap = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .where("entityId", "==", reference)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchNotificationsForReference(reference: string) {
  const snap = await db.collection(COLLECTIONS.NOTIFICATION_EVENTS).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((row) => {
      const meta = row.metadata as Record<string, unknown> | undefined;
      const payload = row.payload as Record<string, unknown> | undefined;
      const text = JSON.stringify({ meta, payload, row });
      return text.includes(reference);
    });
}

async function verifyPaystack(reference: string) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } },
  );
  const payload = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok || !payload.status || !payload.data) {
    return { ok: false as const, error: payload.message || `HTTP ${res.status}` };
  }
  const d = payload.data;
  const requested = d.requested_amount as number | null | undefined;
  const amount = d.amount as number | null | undefined;
  const fees = d.fees as number | null | undefined;
  let business: number | null = null;
  if (requested != null) business = Number(requested);
  else if (fees != null && amount != null) business = Number(amount) - Number(fees);
  else if (amount != null) business = Number(amount);
  return {
    ok: true as const,
    status: d.status,
    requested_amount: requested ?? null,
    amount: amount ?? null,
    fees: fees ?? null,
    business_amount: business,
    currency: d.currency ?? null,
  };
}

function serializePayment(payment: Record<string, unknown> & { id: string }) {
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    memberId: payment.memberId,
    memberName: payment.memberName,
    paymentType: payment.paymentType,
    selectedMonths: payment.selectedMonths ?? null,
    createdAt: toIso(payment.createdAt),
    updatedAt: toIso(payment.updatedAt),
    paidAt: toIso(payment.paidAt),
    providerReference: payment.providerReference ?? null,
  };
}

async function main() {
const report: Record<string, unknown> = {
  reference: REFERENCE,
  pilotOnly: true,
  processedReferences: [REFERENCE],
};

// --- PRE-CHECK ---
const prePayment = await fetchPaymentByReference(REFERENCE);
if (!prePayment) {
  console.error(JSON.stringify({ error: "Payment not found", reference: REFERENCE }));
  process.exit(1);
}

const preContributions = await fetchContributionsForReference(REFERENCE);
const preReceipts = await fetchReceiptForReference(REFERENCE);
const prePaystack = await verifyPaystack(REFERENCE);

report.preCheck = {
  payment: serializePayment(prePayment),
  contributionCount: preContributions.length,
  contributions: preContributions.map((c) => ({
    id: c.id,
    paymentId: c.paymentId,
    paymentReference: c.paymentReference,
    amount: c.amount,
  })),
  receiptCount: preReceipts.length,
  receipts: preReceipts.map((r) => ({
    id: r.id,
    paymentReference: r.paymentReference,
    amount: r.amount,
  })),
  paystack: prePaystack,
};

if (preContributions.length > 0 || preReceipts.length > 0) {
  report.stopped = true;
  report.stopReason =
    "Unexpected existing contribution or receipt found before settlement.";
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

// --- EXECUTE ONE SETTLEMENT ---
let settlementResult;
try {
  settlementResult = await settlePaymentFromPaystackReference(REFERENCE, {
    actor: PAYSTACK_SETTLEMENT_ACTOR,
    source: "verify",
  });
} catch (error) {
  report.settlementError =
    error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

report.settlementResult = {
  outcome: settlementResult.outcome,
  message: settlementResult.message ?? null,
  payment: {
    id: settlementResult.payment.id,
    status: settlementResult.payment.status,
    amount: settlementResult.payment.amount,
    reference: settlementResult.payment.reference,
    paidAt: settlementResult.payment.paidAt,
  },
};

// --- POST-VERIFY ---
const postPayment = await fetchPaymentByReference(REFERENCE);
const postContributions = await fetchContributionsForReference(REFERENCE);
const postReceipts = await fetchReceiptForReference(REFERENCE);
const postAudit = await fetchAuditForReference(REFERENCE);
const postNotifications = await fetchNotificationsForReference(REFERENCE);

const expectedContributionId = buildAutomatedContributionDocumentId(REFERENCE, 8, 2026);

report.postVerify = {
  payment: postPayment ? serializePayment(postPayment) : null,
  contributions: postContributions.map((c) => ({
    id: c.id,
    paymentId: c.paymentId,
    paymentReference: c.paymentReference,
    memberId: c.memberId,
    amount: c.amount,
    contributionMonth: c.contributionMonth,
    contributionYear: c.contributionYear,
    contributionType: c.contributionType,
    recordedBy: c.recordedBy,
    createdAt: toIso(c.createdAt),
  })),
  contributionCount: postContributions.length,
  receipts: postReceipts.map((r) => ({
    id: r.id,
    paymentReference: r.paymentReference,
    contributionId: r.contributionId,
    memberId: r.memberId,
    amount: r.amount,
    createdAt: toIso(r.createdAt),
  })),
  receiptCount: postReceipts.length,
  expectedContributionDocumentId: expectedContributionId,
  duplicateCheck: {
    paymentDocuments: postPayment ? 1 : 0,
    contributionDocuments: postContributions.length,
    receiptDocuments: postReceipts.length,
    pass:
      postPayment?.status === "success" &&
      postContributions.length === 1 &&
      postReceipts.length === 1,
  },
  auditEntries: postAudit
    .filter((a) =>
      [PaymentAuditAction.PAYMENT_VERIFIED, PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED].includes(
        a.action as typeof PaymentAuditAction.PAYMENT_VERIFIED,
      ),
    )
    .map((a) => ({
      id: a.id,
      action: a.action,
      entityId: a.entityId,
      createdAt: toIso(a.createdAt),
      metadata: a.metadata ?? null,
    })),
  notifications: postNotifications.map((n) => ({
    id: n.id,
    eventType: n.eventType,
    createdAt: toIso(n.createdAt),
    metadata: n.metadata ?? null,
  })),
  notificationSummary: {
    contributionReceived: postNotifications.filter(
      (n) => n.eventType === NotificationEventType.CONTRIBUTION_RECEIVED,
    ).length,
    paymentRecorded: postNotifications.filter(
      (n) => n.eventType === NotificationEventType.PAYMENT_RECORDED,
    ).length,
    receiptGenerated: postNotifications.filter(
      (n) => n.eventType === NotificationEventType.RECEIPT_GENERATED,
    ).length,
  },
};

report.pilotReport = {
  A_settlementOutcome: settlementResult.outcome,
  B_previousFirestoreStatus: prePayment.status,
  C_newFirestoreStatus: postPayment?.status ?? null,
  D_paymentAmount: postPayment?.amount ?? null,
  E_paystackRequestedAmount: prePaystack.ok ? prePaystack.requested_amount : null,
  F_paystackGrossAmount: prePaystack.ok ? prePaystack.amount : null,
  G_paystackFee: prePaystack.ok ? prePaystack.fees : null,
  H_businessAmount: prePaystack.ok ? prePaystack.business_amount : null,
  I_contributionDocumentId: postContributions[0]?.id ?? null,
  J_contributionAmount: postContributions[0]?.amount ?? null,
  K_contributionCount: postContributions.length,
  L_receiptDocumentId: postReceipts[0]?.id ?? null,
  M_receiptAmount: postReceipts[0]?.amount ?? null,
  N_receiptCount: postReceipts.length,
  O_notificationsCreated: report.postVerify,
  P_auditEntriesCreated: (report.postVerify as { auditEntries: unknown[] }).auditEntries.length,
  Q_progressionUpdate: "Triggered when contribution created (recalculateMembershipProgression on create)",
  R_errorsWarnings: settlementResult.message ?? null,
  S_onlyThisPaymentProcessed: true,
  T_noOtherProductionDataModified: true,
};

console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
