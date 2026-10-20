/**
 * CONTROLLED PRODUCTION PILOT — Marian Owusu / IS/13022 only.
 * Before snapshot → recalculateMembershipProgression → after snapshot.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filename: string) {
  const filePath = resolve(root, filename);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
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

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();
const SERVICE_NUMBER = "IS/13022";

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return String(v);
}

function serializeDoc(id: string, data: Record<string, unknown>) {
  const out: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && "toDate" in (v as object)) {
      out[k] = toIso(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) => {
        if (item && typeof item === "object" && "toDate" in (item as object)) {
          return toIso(item);
        }
        return item;
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function snapshotMember(memberId: string) {
  const [userDoc, progDoc, contribSnap, paySnap, receiptSnap] =
    await Promise.all([
      db.collection("users").doc(memberId).get(),
      db.collection("membership_progressions").doc(memberId).get(),
      db.collection("contributions").where("memberId", "==", memberId).get(),
      db.collection("payments").where("memberId", "==", memberId).get(),
      db.collection("receipts").where("memberId", "==", memberId).get(),
    ]);

  const user = userDoc.exists
    ? serializeDoc(userDoc.id, userDoc.data() as Record<string, unknown>)
    : null;
  const progression = progDoc.exists
    ? serializeDoc(progDoc.id, progDoc.data() as Record<string, unknown>)
    : null;

  const contributions = contribSnap.docs
    .map((d) => serializeDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const payments = paySnap.docs
    .map((d) => serializeDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const receipts = receiptSnap.docs
    .map((d) => serializeDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return { user, progression, contributions, payments, receipts };
}

function financialFingerprint(snap: Awaited<ReturnType<typeof snapshotMember>>) {
  return {
    contributionIds: snap.contributions.map((c) => c.id),
    contributionSummary: snap.contributions.map((c) => ({
      id: c.id,
      year: c.year,
      month: c.month,
      contributionType: c.contributionType,
      status: c.status,
      amount: c.amount,
      createdAt: c.createdAt,
    })),
    paymentIds: snap.payments.map((p) => p.id),
    paymentSummary: snap.payments.map((p) => ({
      id: p.id,
      reference: p.reference ?? p.paystackReference ?? null,
      amount: p.amount,
      status: p.status,
      paymentType: p.paymentType ?? p.type ?? null,
    })),
    receiptIds: snap.receipts.map((r) => r.id),
    receiptSummary: snap.receipts.map((r) => ({
      id: r.id,
      amount: r.amount,
      contributionId: r.contributionId ?? null,
      paymentId: r.paymentId ?? null,
      status: r.status ?? null,
    })),
  };
}

function pickProgression(p: Record<string, unknown> | null) {
  if (!p) return null;
  return {
    welfarePoints: p.welfarePoints,
    successfulContributionMonths: p.successfulContributionMonths,
    consecutiveContributionMonths: p.consecutiveContributionMonths,
    consecutiveMissedMonths: p.consecutiveMissedMonths,
    outstandingContributionMonths: p.outstandingContributionMonths,
    outstandingMonths: p.outstandingMonths,
    membershipStatus: p.membershipStatus,
    isMature: p.isMature,
    maturityDate: p.maturityDate,
    eligibleToClaim: p.eligibleToClaim,
    progressionEpochMonth: p.progressionEpochMonth,
    lastProgressionResetAt: p.lastProgressionResetAt,
    resetCount: p.resetCount,
    lastCalculatedAt: p.lastCalculatedAt,
  };
}

function pickUser(u: Record<string, unknown> | null) {
  if (!u) return null;
  return {
    id: u.id,
    createdAt: u.createdAt,
    activatedAt: u.activatedAt,
    consecutiveUnpaidMonths: u.consecutiveUnpaidMonths,
    isDefaulter: u.isDefaulter,
    updatedAt: u.updatedAt,
  };
}

async function main() {
  const users = await db
    .collection("users")
    .where("serviceNumber", "==", SERVICE_NUMBER)
    .limit(2)
    .get();

  if (users.empty) {
    throw new Error(`Member not found: ${SERVICE_NUMBER}`);
  }
  if (users.size > 1) {
    throw new Error(`Ambiguous service number: ${SERVICE_NUMBER}`);
  }

  const memberDoc = users.docs[0]!;
  const memberId = memberDoc.id;
  const fullName = String(memberDoc.data().fullName ?? "");

  if (fullName !== "Marian Owusu") {
    throw new Error(
      `Safety stop: expected Marian Owusu, found "${fullName}" (${memberId})`,
    );
  }

  const before = await snapshotMember(memberId);
  const beforeFin = financialFingerprint(before);

  const { recalculateMembershipProgression } = await import(
    "../src/lib/progression/engine.ts"
  );

  await recalculateMembershipProgression(memberId);

  const after = await snapshotMember(memberId);
  const afterFin = financialFingerprint(after);

  const finUnchanged =
    JSON.stringify(beforeFin) === JSON.stringify(afterFin);

  const createdAtUnchanged =
    before.user?.createdAt === after.user?.createdAt;
  const activatedAtUnchanged =
    before.user?.activatedAt === after.user?.activatedAt;

  const beforeP = pickProgression(before.progression);
  const afterP = pickProgression(after.progression);
  const beforeU = pickUser(before.user);
  const afterU = pickUser(after.user);

  const changedFields: string[] = [];
  const check = (
    label: string,
    a: unknown,
    b: unknown,
  ) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changedFields.push(`${label}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
  };

  check("outstandingContributionMonths", beforeP?.outstandingContributionMonths, afterP?.outstandingContributionMonths);
  check("outstandingMonths", beforeP?.outstandingMonths, afterP?.outstandingMonths);
  check("consecutiveMissedMonths", beforeP?.consecutiveMissedMonths, afterP?.consecutiveMissedMonths);
  check("welfarePoints", beforeP?.welfarePoints, afterP?.welfarePoints);
  check("successfulContributionMonths", beforeP?.successfulContributionMonths, afterP?.successfulContributionMonths);
  check("consecutiveContributionMonths", beforeP?.consecutiveContributionMonths, afterP?.consecutiveContributionMonths);
  check("membershipStatus", beforeP?.membershipStatus, afterP?.membershipStatus);
  check("isMature", beforeP?.isMature, afterP?.isMature);
  check("eligibleToClaim", beforeP?.eligibleToClaim, afterP?.eligibleToClaim);
  check("progressionEpochMonth", beforeP?.progressionEpochMonth, afterP?.progressionEpochMonth);
  check("lastProgressionResetAt", beforeP?.lastProgressionResetAt, afterP?.lastProgressionResetAt);
  check("resetCount", beforeP?.resetCount ?? 0, afterP?.resetCount ?? 0);
  check("users.isDefaulter", beforeU?.isDefaulter, afterU?.isDefaulter);
  check("users.consecutiveUnpaidMonths", beforeU?.consecutiveUnpaidMonths, afterU?.consecutiveUnpaidMonths);
  check("lastCalculatedAt", beforeP?.lastCalculatedAt, afterP?.lastCalculatedAt);

  const resetTriggered =
    (Number(afterP?.resetCount ?? 0) || 0) > (Number(beforeP?.resetCount ?? 0) || 0) ||
    (afterP?.lastProgressionResetAt != null &&
      afterP?.lastProgressionResetAt !== beforeP?.lastProgressionResetAt);

  const defaultingTriggered = afterP?.membershipStatus === "DEFAULTING";

  const pointsUnexpected =
    afterP?.welfarePoints !== 2 ||
    afterP?.successfulContributionMonths !== 2;

  const unexpected =
    resetTriggered ||
    defaultingTriggered ||
    pointsUnexpected ||
    !finUnchanged ||
    !createdAtUnchanged ||
    !activatedAtUnchanged ||
    afterP?.membershipStatus !== "ACTIVE" ||
    afterP?.consecutiveMissedMonths !== 0 ||
    afterU?.isDefaulter === true ||
    afterP?.outstandingContributionMonths !== 1;

  const expectedOk =
    afterP?.outstandingContributionMonths === 1 &&
    JSON.stringify(afterP?.outstandingMonths) ===
      JSON.stringify([{ month: 8, year: 2026 }]) &&
    afterP?.welfarePoints === 2 &&
    afterP?.successfulContributionMonths === 2 &&
    afterP?.consecutiveMissedMonths === 0 &&
    afterP?.membershipStatus === "ACTIVE" &&
    afterU?.isDefaulter === false &&
    afterP?.isMature === false &&
    !resetTriggered &&
    finUnchanged &&
    createdAtUnchanged &&
    activatedAtUnchanged;

  const report = {
    A_target: {
      confirmed: true,
      name: fullName,
      serviceNumber: SERVICE_NUMBER,
      memberId,
    },
    B_before: {
      user: beforeU,
      progression: beforeP,
      financial: beforeFin,
    },
    C_recalculationExecuted: true,
    D_after: {
      user: afterU,
      progression: afterP,
      financial: afterFin,
    },
    E_fieldsChanged: changedFields,
    F_financialIntegrity: {
      unchanged: finUnchanged,
      beforeCounts: {
        contributions: beforeFin.contributionIds.length,
        payments: beforeFin.paymentIds.length,
        receipts: beforeFin.receiptIds.length,
      },
      afterCounts: {
        contributions: afterFin.contributionIds.length,
        payments: afterFin.paymentIds.length,
        receipts: afterFin.receiptIds.length,
      },
    },
    G_resetTriggered: resetTriggered,
    H_defaultingTriggered: defaultingTriggered,
    I_unexpectedChanges: unexpected,
    J_verdict: expectedOk
      ? "PASS — MARIAN SUCCESSFULLY REFRESHED"
      : "FAIL — MANUAL REVIEW REQUIRED",
    expectedOk,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
