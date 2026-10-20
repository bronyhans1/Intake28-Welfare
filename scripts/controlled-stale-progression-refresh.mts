/**
 * Controlled stale progression refresh — excludes Marian Owusu / IS/13022.
 * Uses recalculateMembershipProgression only.
 * Aborts the batch if the stale population drifts materially from the prior audit.
 * Skips any member that fails safety classification.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MARIAN_SERVICE = "IS/13022";
const EXPECTED_TOTAL = 214;
const EXPECTED_STALE_AFTER_MARIAN = 202;
const TOTAL_DRIFT_LIMIT = 20;
const STALE_DRIFT_LIMIT = 30;

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

function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return String(v);
}

type MonthKey = { month: number; year: number };

function monthFromIso(iso: string | null): MonthKey | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Accra",
    month: "numeric",
    year: "numeric",
  }).formatToParts(d);
  return {
    month: Number(parts.find((p) => p.type === "month")?.value ?? 1),
    year: Number(parts.find((p) => p.type === "year")?.value ?? d.getFullYear()),
  };
}

function getCurrentMonthYear(): MonthKey {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Accra",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date());
  return {
    month: Number(parts.find((p) => p.type === "month")?.value ?? 1),
    year: Number(parts.find((p) => p.type === "year")?.value ?? new Date().getFullYear()),
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { calculateProgressionFromContributions } = await import(
    "../src/lib/progression/calculator.ts"
  );
  const { recalculateMembershipProgression } = await import(
    "../src/lib/progression/engine.ts"
  );

  const asOf = getCurrentMonthYear();
  const [usersSnap, contribSnap, progSnap, paymentsSnapBefore, receiptsSnapBefore] =
    await Promise.all([
      db.collection("users").get(),
      db.collection("contributions").get(),
      db.collection("membership_progressions").get(),
      db.collection("payments").get(),
      db.collection("receipts").get(),
    ]);

  const contribByMember = new Map<
    string,
    Array<{
      year: number;
      month: number;
      contributionType: string;
      status: string;
      contributedAt: string | null;
    }>
  >();

  for (const doc of contribSnap.docs) {
    const c = doc.data();
    const memberId = String(c.memberId ?? "");
    if (!memberId) continue;
    if (!contribByMember.has(memberId)) contribByMember.set(memberId, []);
    contribByMember.get(memberId)!.push({
      year: Number(c.year),
      month: Number(c.month),
      contributionType: String(c.contributionType ?? ""),
      status: String(c.status ?? ""),
      contributedAt: toIso(c.createdAt),
    });
  }

  const progById = new Map(
    progSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>]),
  );

  type Candidate = {
    memberId: string;
    name: string;
    serviceNumber: string;
    classification:
      | "IN_SYNC"
      | "STALE_SAFE"
      | "SKIP_MARIAN"
      | "MANUAL_REVIEW"
      | "SUSPICIOUS";
    reason?: string;
  };

  const candidates: Candidate[] = [];
  let staleSafe = 0;
  let inSync = 0;
  let manualReview = 0;
  let suspicious = 0;
  let marianExcluded = 0;

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    const serviceNumber = String(u.serviceNumber ?? "");
    const name = String(u.fullName ?? "");
    const createdAtIso = toIso(u.createdAt);
    const createdMonth = monthFromIso(createdAtIso);

    if (!createdMonth || !createdAtIso) {
      candidates.push({
        memberId: doc.id,
        name,
        serviceNumber,
        classification: "MANUAL_REVIEW",
        reason: "missing_createdAt",
      });
      manualReview += 1;
      continue;
    }

    if (serviceNumber === MARIAN_SERVICE) {
      candidates.push({
        memberId: doc.id,
        name,
        serviceNumber,
        classification: "SKIP_MARIAN",
        reason: "pilot_already_refreshed",
      });
      marianExcluded += 1;
      continue;
    }

    const isSuspicious = createdMonth.year < 2026;
    const contribs = contribByMember.get(doc.id) ?? [];
    const persisted = progById.get(doc.id) ?? null;
    const existingEpoch = persisted?.progressionEpochMonth as
      | { month?: number; year?: number }
      | null
      | undefined;
    const epochInput =
      existingEpoch &&
      typeof existingEpoch.month === "number" &&
      typeof existingEpoch.year === "number"
        ? { month: existingEpoch.month, year: existingEpoch.year }
        : null;

    const primary = calculateProgressionFromContributions({
      memberId: doc.id,
      contributions: contribs,
      membershipStart: createdMonth,
      asOf,
      defaulterThresholdMonths: 2,
      postMaturityResetMonths: 6,
      existingMaturityDate: toIso(persisted?.maturityDate) ?? null,
      existingProgressionEpoch: epochInput,
      existingResetCount:
        typeof persisted?.resetCount === "number" ? persisted.resetCount : 0,
      existingLastProgressionResetAt:
        toIso(persisted?.lastProgressionResetAt) ?? null,
    });

    const julyInOutstanding = primary.outstandingMonths.some(
      (m) => m.year === 2026 && m.month === 7 && createdMonth.month >= 8,
    );

    if (isSuspicious) {
      candidates.push({
        memberId: doc.id,
        name,
        serviceNumber,
        classification: "SUSPICIOUS",
        reason: "createdAt_year_before_2026",
      });
      suspicious += 1;
      continue;
    }

    if (
      primary.didReset ||
      primary.membershipStatus === "DEFAULTING" ||
      julyInOutstanding
    ) {
      candidates.push({
        memberId: doc.id,
        name,
        serviceNumber,
        classification: "MANUAL_REVIEW",
        reason: primary.didReset
          ? "would_reset"
          : primary.membershipStatus === "DEFAULTING"
            ? "would_defaulting"
            : "july_in_outstanding",
      });
      manualReview += 1;
      continue;
    }

    const persistedOutstanding =
      typeof persisted?.outstandingContributionMonths === "number"
        ? persisted.outstandingContributionMonths
        : Array.isArray(persisted?.outstandingMonths)
          ? (persisted!.outstandingMonths as unknown[]).length
          : null;
    const persistedPoints =
      typeof persisted?.welfarePoints === "number"
        ? persisted.welfarePoints
        : null;
    const persistedMissed =
      typeof persisted?.consecutiveMissedMonths === "number"
        ? persisted.consecutiveMissedMonths
        : null;
    const persistedStatus = (persisted?.membershipStatus as string) ?? null;
    const persistedSuccessful =
      typeof persisted?.successfulContributionMonths === "number"
        ? persisted.successfulContributionMonths
        : null;
    const usersIsDefaulter = Boolean(u.isDefaulter);

    const stale =
      persistedOutstanding !== primary.outstandingContributionMonths ||
      persistedPoints !== primary.welfarePoints ||
      persistedMissed !== primary.consecutiveMissedMonths ||
      persistedStatus !== primary.membershipStatus ||
      persistedSuccessful !== primary.successfulContributionMonths ||
      usersIsDefaulter !== (primary.membershipStatus === "DEFAULTING");

    if (!stale) {
      candidates.push({
        memberId: doc.id,
        name,
        serviceNumber,
        classification: "IN_SYNC",
      });
      inSync += 1;
      continue;
    }

    candidates.push({
      memberId: doc.id,
      name,
      serviceNumber,
      classification: "STALE_SAFE",
    });
    staleSafe += 1;
  }

  const total = usersSnap.size;
  const contribCountBefore = contribSnap.size;
  const paymentCountBefore = paymentsSnapBefore.size;
  const receiptCountBefore = receiptsSnapBefore.size;
  const driftTotal = Math.abs(total - EXPECTED_TOTAL) > TOTAL_DRIFT_LIMIT;
  const driftStale =
    Math.abs(staleSafe - EXPECTED_STALE_AFTER_MARIAN) > STALE_DRIFT_LIMIT;

  const identification = {
    asOf,
    dryRun,
    totalMembers: total,
    contributionDocuments: contribCountBefore,
    staleSafeBeforeRefresh: staleSafe,
    inSync,
    marianExcluded,
    manualReview,
    suspicious,
    expectedTotal: EXPECTED_TOTAL,
    expectedStaleAfterMarian: EXPECTED_STALE_AFTER_MARIAN,
    materialDrift: driftTotal || driftStale,
    skippedSafetySample: candidates
      .filter(
        (c) =>
          c.classification === "MANUAL_REVIEW" ||
          c.classification === "SUSPICIOUS" ||
          c.classification === "SKIP_MARIAN",
      )
      .slice(0, 30),
  };

  if (driftTotal || driftStale) {
    console.log(
      JSON.stringify(
        {
          aborted: true,
          reason: driftTotal
            ? "total_population_drift"
            : "stale_population_drift",
          identification,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          aborted: false,
          dryRun: true,
          identification,
          wouldRecalculate: staleSafe,
        },
        null,
        2,
      ),
    );
    return;
  }

  const toRefresh = candidates.filter((c) => c.classification === "STALE_SAFE");
  let success = 0;
  const failed: Array<{
    memberId: string;
    serviceNumber: string;
    error: string;
  }> = [];
  const skippedDuringRun: Array<{
    memberId: string;
    serviceNumber: string;
    reason: string;
  }> = [];

  for (const item of toRefresh) {
    if (item.serviceNumber === MARIAN_SERVICE) {
      skippedDuringRun.push({
        memberId: item.memberId,
        serviceNumber: item.serviceNumber,
        reason: "marian_guard",
      });
      continue;
    }

    try {
      const uDoc = await db.collection("users").doc(item.memberId).get();
      const u = uDoc.data();
      if (!u || String(u.serviceNumber) === MARIAN_SERVICE) {
        skippedDuringRun.push({
          memberId: item.memberId,
          serviceNumber: item.serviceNumber,
          reason: "marian_guard",
        });
        continue;
      }

      await recalculateMembershipProgression(item.memberId);
      success += 1;
    } catch (error) {
      failed.push({
        memberId: item.memberId,
        serviceNumber: item.serviceNumber,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const contribSnapAfter = await db.collection("contributions").get();
  const paymentsSnapAfter = await db.collection("payments").get();
  const receiptsSnapAfter = await db.collection("receipts").get();

  console.log(
    JSON.stringify(
      {
        aborted: false,
        identification,
        refresh: {
          identifiedStaleSafe: toRefresh.length,
          successfullyRecalculated: success,
          failed: failed.length,
          skippedDuringRun: skippedDuringRun.length,
          skippedSafetyTotal: manualReview + suspicious + marianExcluded,
          failedDetails: failed,
          skippedDuringRunDetails: skippedDuringRun,
        },
        financialIntegrity: {
          contributionsUnchanged:
            contribSnapAfter.size === contribCountBefore,
          paymentsUnchanged: paymentsSnapAfter.size === paymentCountBefore,
          receiptsUnchanged: receiptsSnapAfter.size === receiptCountBefore,
          contributionCountBefore: contribCountBefore,
          contributionCountAfter: contribSnapAfter.size,
          paymentCountBefore,
          paymentCountAfter: paymentsSnapAfter.size,
          receiptCountBefore,
          receiptCountAfter: receiptsSnapAfter.size,
        },
        marianRecalculated: false,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
