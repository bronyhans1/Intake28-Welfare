/**
 * READ-ONLY production payment reconciliation audit.
 * - Firestore: read only
 * - Paystack: verify GET only
 * - No writes to Firestore, Paystack, or workspace files (stdout only)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename) {
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

loadEnvFile(".env.local");
loadEnvFile(".env");

const REFS = [
  ["bennyofosua1@gmail.com", "GIS-20260827-BVFG3H"],
  ["abenaboafoa97@gmail.com", "GIS-20260827-WFFKXF"],
  ["gyankomahrose6088@yahoo.com", "GIS-20260827-DCS6AR"],
  ["is14340@gis28welfare.org", "GIS-20260827-8TDQ39"],
  ["is13552@gis28welfare.org", "GIS-20260827-BKSDE9"],
  ["is13544@gis28welfare.org", "GIS-20260827-2W8XXN"],
  ["kingsleybiiya88@gmail.com", "GIS-20260827-SE8SSP"],
  ["is12511@gis28welfare.org", "GIS-20260827-99VYAN"],
  ["is13443@gis28welfare.org", "GIS-20260827-AZ9NF5"],
  ["is12997@gis28welfare.org", "GIS-20260827-MFWERJ"],
  ["is12334@gis28welfare.org", "GIS-20260827-46JM4R"],
  ["jennifernsiah1406@gmail.com", "GIS-20260827-JZ68P2"],
  ["is12980@gis28welfare.org", "GIS-20260827-GKUXN9"],
  ["lydiaadjeimensah8@gmail.com", "GIS-20260827-4DBFYX"],
  ["is12910@gis28welfare.org", "GIS-20260827-QJEXY4"],
  ["opoku8062@gmail.com", "GIS-20260827-U29EB5"],
  ["oforieugene6@gmail.com", "GIS-20260828-XPQB8V"],
  ["is12663@gis28welfare.org", "GIS-20260828-559M4B"],
  ["is12260@gis28welfare.org", "GIS-20260828-XV95KD"],
  ["derrickamoako@gmail.com", "GIS-20260828-3PP252"],
  ["is12297@gis28welfare.org", "GIS-20260828-UMVKSX"],
  ["georgekonzabre33@gmail.com", "GIS-20260828-TRGHSD"],
  ["dlarbiodei@gmail.com", "GIS-20260829-HUBR3R"],
  ["is12652@gis28welfare.org", "GIS-20260829-W5BLG3"],
  ["is12777@gis28welfare.org", "GIS-20260829-HDAM5N"],
];

function toIso(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v.toDate) return v.toDate().toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function businessMinor(data) {
  if (!data) return null;
  if (data.requested_amount != null) return Number(data.requested_amount);
  if (data.fees != null && data.amount != null) {
    return Number(data.amount) - Number(data.fees);
  }
  if (data.amount != null) return Number(data.amount);
  return null;
}

async function verifyPaystack(reference, secret) {
  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const payload = await res.json();
  if (!res.ok || !payload.status || !payload.data) {
    return {
      ok: false,
      error: payload.message || `HTTP ${res.status}`,
      reference,
    };
  }
  const d = payload.data;
  return {
    ok: true,
    reference: d.reference,
    status: d.status,
    transactionId: d.id ?? null,
    amount: d.amount ?? null,
    requested_amount: d.requested_amount ?? null,
    fees: d.fees ?? null,
    business_amount: businessMinor(d),
    currency: d.currency ?? null,
    paid_at: d.paid_at ?? d.paidAt ?? null,
    channel: d.channel ?? null,
    customer_email: d.customer?.email ?? d.email ?? null,
  };
}

function classify(paystack, payment, contributions, receipt) {
  if (!paystack.ok) return "NOT_FOUND";
  const fsStatus = payment?.status ?? "MISSING";
  const psStatus = paystack.status;
  const expectedMinor = payment ? Math.round(Number(payment.amount) * 100) : null;
  const biz = paystack.business_amount;
  const curFs = payment?.currency;
  const curPs = paystack.currency;
  if (curFs && curPs && String(curFs).toUpperCase() !== String(curPs).toUpperCase()) {
    return "CURRENCY_MISMATCH";
  }
  if (expectedMinor != null && biz != null && biz !== expectedMinor) {
    return "AMOUNT_MISMATCH";
  }
  if (psStatus === "abandoned") return "ABANDONED";
  if (psStatus === "failed") return "FAILED";
  if (psStatus !== "success") return "UNCERTAIN";
  if (!payment) return "UNCERTAIN";
  if (fsStatus === "success") {
    if (contributions.length === 0) return "SUCCESS_MISSING_CONTRIBUTION";
    if (!receipt) return "SUCCESS_MISSING_RECEIPT";
    return "ALREADY_SETTLED";
  }
  if (fsStatus === "pending") {
    if (expectedMinor != null && biz === expectedMinor) return "SAFE_TO_RECONCILE";
    return "PAYSTACK_SUCCESS_FIRESTORE_PENDING";
  }
  if (fsStatus === "abandoned") {
    if (expectedMinor != null && biz === expectedMinor) {
      return "PAYSTACK_SUCCESS_FIRESTORE_ABANDONED";
    }
    return "UNCERTAIN";
  }
  return "UNCERTAIN";
}

const secret = process.env.PAYSTACK_SECRET_KEY;
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.error(JSON.stringify({ error: "Firebase admin env missing" }));
  process.exit(1);
}
if (!secret) {
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
const [paymentsSnap, contributionsSnap, receiptsSnap] = await Promise.all([
  db.collection("payments").get(),
  db.collection("contributions").get(),
  db.collection("receipts").get(),
]);

const payments = paymentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
const contributions = contributionsSnap.docs.map((doc) => ({
  id: doc.id,
  ...doc.data(),
}));
const receipts = receiptsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

const paymentByRef = new Map(
  payments.filter((p) => p.reference).map((p) => [p.reference, p]),
);
const contributionsByRef = new Map();
for (const c of contributions) {
  const ref = c.paymentReference;
  if (!ref) continue;
  if (!contributionsByRef.has(ref)) contributionsByRef.set(ref, []);
  contributionsByRef.get(ref).push(c);
}
const receiptByRef = new Map(
  receipts.filter((r) => r.paymentReference).map((r) => [r.paymentReference, r]),
);

async function auditReference(reference, emailHint) {
  const payment = paymentByRef.get(reference) ?? null;
  const contribs = contributionsByRef.get(reference) ?? [];
  const receipt = receiptByRef.get(reference) ?? null;
  const paystack = await verifyPaystack(reference, secret);
  return {
    email: emailHint ?? payment?.email ?? null,
    reference,
    paystack,
    firestore: payment
      ? {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          memberId: payment.memberId,
          memberName: payment.memberName,
          email: payment.email,
          paymentType: payment.paymentType,
          provider: payment.provider,
          createdAt: toIso(payment.createdAt),
          updatedAt: toIso(payment.updatedAt),
          paidAt: toIso(payment.paidAt),
        }
      : null,
    contributions: contribs.map((c) => ({
      id: c.id,
      paymentId: c.paymentId,
      paymentReference: c.paymentReference,
      memberId: c.memberId,
      amount: c.amount,
      contributionMonth: c.contributionMonth,
      contributionYear: c.contributionYear,
      status: c.status,
      createdAt: toIso(c.createdAt),
    })),
    contributionCount: contribs.length,
    hasReceipt: Boolean(receipt),
    receipt: receipt
      ? {
          id: receipt.id,
          paymentReference: receipt.paymentReference,
          contributionId: receipt.contributionId,
          amount: receipt.amount,
          memberId: receipt.memberId,
          createdAt: toIso(receipt.createdAt),
        }
      : null,
    classification: classify(paystack, payment, contribs, receipt),
  };
}

const provided = [];
for (let i = 0; i < REFS.length; i++) {
  const [email, reference] = REFS[i];
  provided.push({ index: i + 1, ...(await auditReference(reference, email)) });
}

const altRose = await auditReference(
  "GIS-20260827-DC6SAR",
  "gyankomahrose6088@yahoo.com (alt DC6SAR)",
);

const pendingPaystack = payments.filter(
  (p) => p.provider === "paystack" && p.status === "pending",
);
const pendingAudit = [];
for (const p of pendingPaystack) {
  pendingAudit.push(await auditReference(p.reference, p.email));
}

const duplicateContribs = [];
for (const [ref, rows] of contributionsByRef.entries()) {
  if (rows.length > 1) {
    duplicateContribs.push({
      paymentReference: ref,
      count: rows.length,
      rows: rows.map((c) => ({
        id: c.id,
        paymentId: c.paymentId,
        memberId: c.memberId,
        amount: c.amount,
        contributionMonth: c.contributionMonth,
        contributionYear: c.contributionYear,
        createdAt: toIso(c.createdAt),
      })),
    });
  }
}

const successPayments = payments.filter((p) => p.status === "success" && p.provider === "paystack");
const successMissingContrib = [];
const successMissingReceipt = [];
for (const p of successPayments) {
  const contribs = contributionsByRef.get(p.reference) ?? [];
  const receipt = receiptByRef.get(p.reference);
  if (contribs.length === 0) {
    successMissingContrib.push({ reference: p.reference, memberName: p.memberName, email: p.email });
  }
  if (contribs.length > 0 && !receipt) {
    successMissingReceipt.push({ reference: p.reference, memberName: p.memberName, email: p.email });
  }
}

console.log(
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      provided,
      altRose,
      pendingPaystack: pendingAudit,
      pendingCount: pendingPaystack.length,
      duplicateContribs,
      successMissingContrib,
      successMissingReceipt,
    },
    null,
    2,
  ),
);
