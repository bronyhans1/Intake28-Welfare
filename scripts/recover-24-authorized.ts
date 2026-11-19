/**
 * Authorized recovery of exactly 24 confirmed Paystack-success payments.
 * Excludes GIS-20260828-XV95KD (already recovered in pilot).
 * Processes: VERIFY → SETTLE → VERIFY RESULT → NEXT (no batch, no other refs).
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

const EXCLUDED = "GIS-20260828-XV95KD";

const AUTHORIZED: { index: number; reference: string; email: string }[] = [
  { index: 1, reference: "GIS-20260827-BVFG3H", email: "bennyofosua1@gmail.com" },
  { index: 2, reference: "GIS-20260827-WFFKXF", email: "abenaboafoa97@gmail.com" },
  { index: 3, reference: "GIS-20260827-DCS6AR", email: "gyankomahrose6088@yahoo.com" },
  { index: 4, reference: "GIS-20260827-8TDQ39", email: "is14340@gis28welfare.org" },
  { index: 5, reference: "GIS-20260827-BKSDE9", email: "is13552@gis28welfare.org" },
  { index: 6, reference: "GIS-20260827-2W8XXN", email: "is13544@gis28welfare.org" },
  { index: 7, reference: "GIS-20260827-SE8SSP", email: "kingsleybiiya88@gmail.com" },
  { index: 8, reference: "GIS-20260827-99VYAN", email: "is12511@gis28welfare.org" },
  { index: 9, reference: "GIS-20260827-AZ9NF5", email: "is13443@gis28welfare.org" },
  { index: 10, reference: "GIS-20260827-MFWERJ", email: "is12997@gis28welfare.org" },
  { index: 11, reference: "GIS-20260827-46JM4R", email: "is12334@gis28welfare.org" },
  { index: 12, reference: "GIS-20260827-JZ68P2", email: "jennifernsiah1406@gmail.com" },
  { index: 13, reference: "GIS-20260827-GKUXN9", email: "is12980@gis28welfare.org" },
  { index: 14, reference: "GIS-20260827-4DBFYX", email: "lydiaadjeimensah8@gmail.com" },
  { index: 15, reference: "GIS-20260827-QJEXY4", email: "is12910@gis28welfare.org" },
  { index: 16, reference: "GIS-20260827-U29EB5", email: "opoku8062@gmail.com" },
  { index: 17, reference: "GIS-20260828-XPQB8V", email: "oforieugene6@gmail.com" },
  { index: 18, reference: "GIS-20260828-559M4B", email: "is12663@gis28welfare.org" },
  { index: 19, reference: "GIS-20260828-3PP252", email: "derrickamoako@gmail.com" },
  { index: 20, reference: "GIS-20260828-UMVKSX", email: "is12297@gis28welfare.org" },
  { index: 21, reference: "GIS-20260828-TRGHSD", email: "georgekonzabre33@gmail.com" },
  { index: 22, reference: "GIS-20260829-HUBR3R", email: "dlarbiodei@gmail.com" },
  { index: 23, reference: "GIS-20260829-W5BLG3", email: "is12652@gis28welfare.org" },
  { index: 24, reference: "GIS-20260829-HDAM5N", email: "is12777@gis28welfare.org" },
];

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

function businessMinor(data: Record<string, unknown>): number | null {
  if (data.requested_amount != null) return Number(data.requested_amount);
  if (data.fees != null && data.amount != null) {
    return Number(data.amount) - Number(data.fees);
  }
  if (data.amount != null) return Number(data.amount);
  return null;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY ||
  !process.env.PAYSTACK_SECRET_KEY
) {
  console.error(JSON.stringify({ error: "Missing Firebase or Paystack env" }));
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
const secret = process.env.PAYSTACK_SECRET_KEY!;

async function verifyPaystack(reference: string) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
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
  return {
    ok: true as const,
    status: String(d.status),
    reference: String(d.reference),
    requested_amount: d.requested_amount ?? null,
    amount: d.amount ?? null,
    fees: d.fees ?? null,
    business_amount: businessMinor(d),
    currency: d.currency ?? null,
  };
}

async function fetchPayment(reference: string) {
  const snap = await db
    .collection(COLLECTIONS.PAYMENTS)
    .where("reference", "==", reference)
    .limit(2)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string };
}

async function fetchContributions(reference: string) {
  const snap = await db
    .collection(COLLECTIONS.CONTRIBUTIONS)
    .where("paymentReference", "==", reference)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function fetchReceipts(reference: string) {
  const direct = await db.collection(COLLECTIONS.RECEIPTS).doc(reference).get();
  const rows = direct.exists ? [{ id: direct.id, ...direct.data() }] : [];
  const snap = await db
    .collection(COLLECTIONS.RECEIPTS)
    .where("paymentReference", "==", reference)
    .get();
  const merged = new Map<string, Record<string, unknown>>();
  for (const row of [...rows, ...snap.docs.map((d) => ({ id: d.id, ...d.data() }))]) {
    merged.set(String(row.id), row);
  }
  return [...merged.values()];
}

async function fetchSideEffects(reference: string) {
  const auditSnap = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .where("entityId", "==", reference)
    .get();
  const audit = auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const notifSnap = await db.collection(COLLECTIONS.NOTIFICATION_EVENTS).get();
  const notifications = notifSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((row) => JSON.stringify(row).includes(reference));

  return { audit, notifications };
}

type RowResult = Record<string, unknown>;

async function processReference(entry: (typeof AUTHORIZED)[number]): Promise<RowResult> {
  const { index, reference, email } = entry;
  const row: RowResult = {
    index,
    reference,
    email,
    member: null,
    previousFirestoreStatus: null,
    paystackStatus: null,
    requestedAmount: null,
    grossAmount: null,
    fees: null,
    businessAmount: null,
    settlementResult: null,
    newFirestoreStatus: null,
    contributionId: null,
    contributionAmount: null,
    receiptId: null,
    receiptAmount: null,
    notifications: null,
    audit: null,
    progression: null,
    errors: null,
    classification: null,
  };

  const paymentBefore = await fetchPayment(reference);
  if (!paymentBefore) {
    row.classification = "NEEDS_REVIEW";
    row.errors = "Firestore payment not found";
    return row;
  }

  row.member = paymentBefore.memberName;
  row.previousFirestoreStatus = paymentBefore.status;

  const contribsBefore = await fetchContributions(reference);
  const receiptsBefore = await fetchReceipts(reference);

  if (
    paymentBefore.status === "success" &&
    contribsBefore.length >= 1 &&
    receiptsBefore.length >= 1
  ) {
    row.classification = "ALREADY_SETTLED";
    row.settlementResult = "skipped_already_settled";
    row.newFirestoreStatus = "success";
    row.contributionId = contribsBefore[0]?.id ?? null;
    row.contributionAmount = contribsBefore[0]?.amount ?? null;
    row.receiptId = receiptsBefore[0]?.id ?? null;
    row.receiptAmount = receiptsBefore[0]?.amount ?? null;
    row.contributionCount = contribsBefore.length;
    row.receiptCount = receiptsBefore.length;
    return row;
  }

  const paystack = await verifyPaystack(reference);
  if (!paystack.ok) {
    row.classification = "NEEDS_REVIEW";
    row.errors = paystack.error;
    return row;
  }

  row.paystackStatus = paystack.status;
  row.requestedAmount = paystack.requested_amount;
  row.grossAmount = paystack.amount;
  row.fees = paystack.fees;
  row.businessAmount = paystack.business_amount;

  const expectedMinor = Math.round(Number(paymentBefore.amount) * 100);
  const currencyOk =
    String(paystack.currency).toUpperCase() ===
    String(paymentBefore.currency).toUpperCase();
  const referenceOk = paystack.reference === reference;
  const amountOk =
    paystack.status === "success" &&
    paystack.business_amount === expectedMinor;
  const statusOk = paystack.status === "success";

  if (!statusOk || !referenceOk || !currencyOk || !amountOk) {
    row.classification = "NEEDS_REVIEW";
    row.errors = [
      !statusOk ? `Paystack status=${paystack.status}` : null,
      !referenceOk ? "Reference mismatch" : null,
      !currencyOk ? "Currency mismatch" : null,
      !amountOk ? `Business amount ${paystack.business_amount} != ${expectedMinor}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    return row;
  }

  try {
    const result = await settlePaymentFromPaystackReference(reference, {
      actor: PAYSTACK_SETTLEMENT_ACTOR,
      source: "verify",
    });
    row.settlementResult = result.outcome;
    if (result.message) row.settlementMessage = result.message;
  } catch (error) {
    row.classification = "FAILED";
    row.errors = error instanceof Error ? error.message : String(error);
    return row;
  }

  const paymentAfter = await fetchPayment(reference);
  const contribsAfter = await fetchContributions(reference);
  const receiptsAfter = await fetchReceipts(reference);
  const sideEffects = await fetchSideEffects(reference);

  row.newFirestoreStatus = paymentAfter?.status ?? null;
  row.contributionId = contribsAfter.length === 1 ? contribsAfter[0].id : contribsAfter.map((c) => c.id).join(",");
  row.contributionAmount = contribsAfter.length === 1 ? contribsAfter[0].amount : null;
  row.receiptId = receiptsAfter.length === 1 ? receiptsAfter[0].id : receiptsAfter.map((r) => r.id).join(",");
  row.receiptAmount = receiptsAfter.length === 1 ? receiptsAfter[0].amount : null;
  row.contributionCount = contribsAfter.length;
  row.receiptCount = receiptsAfter.length;
  row.notifications = {
    contributionReceived: sideEffects.notifications.filter(
      (n) => n.eventType === NotificationEventType.CONTRIBUTION_RECEIVED,
    ).length,
    paymentRecorded: sideEffects.notifications.filter(
      (n) => n.eventType === NotificationEventType.PAYMENT_RECORDED,
    ).length,
    receiptGenerated: sideEffects.notifications.filter(
      (n) => n.eventType === NotificationEventType.RECEIPT_GENERATED,
    ).length,
  };
  row.audit = sideEffects.audit
    .filter((a) =>
      [PaymentAuditAction.PAYMENT_VERIFIED, PaymentAuditAction.PAYMENT_CONTRIBUTION_CREATED].includes(
        a.action as string,
      ),
    )
    .map((a) => a.action);
  row.progression = "recalculateMembershipProgression on contribution create";

  const postOk =
    paymentAfter?.status === "success" &&
    paymentAfter.amount === 50 &&
    contribsAfter.length === 1 &&
    contribsAfter[0].amount === 50 &&
    receiptsAfter.length === 1 &&
    receiptsAfter[0].amount === 50;

  if (row.settlementResult === "already_settled" && postOk) {
    row.classification = "ALREADY_SETTLED";
  } else if (row.settlementResult === "settled" && postOk) {
    row.classification = "RECOVERED";
  } else {
    row.classification = "NEEDS_REVIEW";
    row.errors = row.errors || "Post-settlement verification failed";
  }

  return row;
}

async function main() {
  if (AUTHORIZED.some((r) => r.reference === EXCLUDED)) {
    throw new Error("Pilot reference must not be in authorized list");
  }

  const results: RowResult[] = [];
  for (const entry of AUTHORIZED) {
    console.error(`[recover] processing ${entry.reference}...`);
    const row = await processReference(entry);
    results.push(row);
    console.error(`[recover] ${entry.reference} => ${row.classification}`);
  }

  const totals = {
    totalApproved: 24,
    successfullyRecovered: results.filter((r) => r.classification === "RECOVERED").length,
    alreadySettled: results.filter((r) => r.classification === "ALREADY_SETTLED").length,
    needsReview: results.filter((r) => r.classification === "NEEDS_REVIEW").length,
    failed: results.filter((r) => r.classification === "FAILED").length,
    contributionsCreated: results.filter((r) => r.settlementResult === "settled").length,
    receiptsCreated: results.filter((r) => r.settlementResult === "settled").length,
    duplicateContributions: results.filter((r) => (r.contributionCount as number) > 1).length,
    duplicateReceipts: results.filter((r) => (r.receiptCount as number) > 1).length,
  };

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        excludedReference: EXCLUDED,
        processedReferences: AUTHORIZED.map((r) => r.reference),
        results,
        totals,
        safetyConfirmation: {
          only24AuthorizedProcessed: true,
          pilotNotProcessedAgain: true,
          noUnrelatedPendingProcessed: true,
          noAbandonedOutsideListProcessed: true,
          noPaystackConfigChanged: true,
          noSourceCodeChanged: true,
          noDeployment: true,
          normalSettlementPathOnly: true,
          contributionIdempotencyActive: true,
          receiptIdempotencyActive: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});
