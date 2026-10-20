/**
 * READ-ONLY production impact audit — final progression rules.
 * No Firestore writes. No cron. No recalculation persistence.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Load compiled/ts via vitest-compatible path: register ts-node alternative — use dynamic import of dist if needed.
// Prefer spawning through tsx in shell; this file is run via npx tsx.

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

function cmp(a: MonthKey, b: MonthKey) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function keyOf(p: MonthKey) {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

async function main() {
  const { calculateProgressionFromContributions } = await import(
    "../src/lib/progression/calculator.ts"
  );

  const asOf = getCurrentMonthYear();
  const intakeStart = new Date("2026-08-07T00:00:00.000Z");

  const [usersSnap, contribSnap, progSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("contributions").get(),
    db.collection("membership_progressions").get(),
  ]);

  type ContribRow = {
    memberId: string;
    year: number;
    month: number;
    contributionType: string;
    status: string;
    createdAt: string | null;
  };

  const contribByMember = new Map<string, ContribRow[]>();
  for (const doc of contribSnap.docs) {
    const c = doc.data();
    const row: ContribRow = {
      memberId: String(c.memberId ?? ""),
      year: Number(c.year),
      month: Number(c.month),
      contributionType: String(c.contributionType ?? ""),
      status: String(c.status ?? ""),
      createdAt: toIso(c.createdAt),
    };
    if (!row.memberId) continue;
    if (!contribByMember.has(row.memberId)) contribByMember.set(row.memberId, []);
    contribByMember.get(row.memberId)!.push(row);
  }

  const progById = new Map(
    progSnap.docs.map((d) => [d.id, d.data() as Record<string, unknown>]),
  );

  const rows: Record<string, unknown>[] = [];
  let createdOnOrAfterAug7 = 0;
  let activatedAfterCreation = 0;
  let augCreatedSepActivated = 0;
  let sepCreatedSepActivated = 0;
  let augCreatedNotActivated = 0;
  let suspiciousCreatedAt = 0;
  let augustOutstanding = 0;
  let augustPaid = 0;
  let augustMissing = 0;
  let julyManual = 0;
  let staleCount = 0;
  let manualReview = 0;
  let wouldReset = 0;
  let inSync = 0;
  let openMonthViolation = 0;

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    const createdAtIso = toIso(u.createdAt);
    const activatedAtIso = toIso(u.activatedAt);
    const createdMonth = monthFromIso(createdAtIso);
    const activatedMonth = monthFromIso(activatedAtIso);
    if (!createdMonth || !createdAtIso) continue;

    const createdDate = new Date(createdAtIso);
    const activatedDate = activatedAtIso ? new Date(activatedAtIso) : null;

    if (createdDate >= intakeStart) createdOnOrAfterAug7 += 1;
    if (activatedDate && activatedDate > createdDate) activatedAfterCreation += 1;

    const isAugCreated =
      createdMonth.year === 2026 && createdMonth.month === 8;
    const isSepCreated =
      createdMonth.year === 2026 && createdMonth.month === 9;
    const isSepActivated =
      activatedMonth?.year === 2026 && activatedMonth?.month === 9;
    const notActivated = !activatedAtIso;

    if (isAugCreated && isSepActivated) augCreatedSepActivated += 1;
    if (isSepCreated && isSepActivated) sepCreatedSepActivated += 1;
    if (isAugCreated && notActivated) augCreatedNotActivated += 1;

    // Suspicious: created after intake start but Accra month before Aug 2026
    // OR createdAt calendar month << activated by >1 month with weird history
    let suspicious = false;
    let suspiciousReason: string | null = null;
    if (
      createdDate >= intakeStart &&
      (createdMonth.year < 2026 ||
        (createdMonth.year === 2026 && createdMonth.month < 8))
    ) {
      suspicious = true;
      suspiciousReason = "createdAt_after_intake_but_month_before_aug_2026";
      suspiciousCreatedAt += 1;
    } else if (createdMonth.year < 2026 || createdMonth.year > 2026) {
      // flag very old or future years for review if active welfare members
      if (createdMonth.year < 2026) {
        suspicious = true;
        suspiciousReason = "createdAt_year_before_2026";
        suspiciousCreatedAt += 1;
      }
    }

    const contribs = contribByMember.get(doc.id) ?? [];
    const progressionInputs = contribs.map((c) => ({
      year: c.year,
      month: c.month,
      contributionType: c.contributionType,
      status: c.status,
      contributedAt: c.createdAt,
    }));

    const paidMonthly = contribs.filter(
      (c) =>
        c.contributionType === "monthly_dues" &&
        c.status === "paid" &&
        Number.isFinite(c.month) &&
        Number.isFinite(c.year),
    );

    const paidMonths = [
      ...new Set(paidMonthly.map((c) => keyOf({ year: c.year, month: c.month }))),
    ].sort();

    const hasJulyPaid = paidMonths.includes("2026-07");
    if (hasJulyPaid) julyManual += 1;

    const firstContribution = paidMonthly
      .map((c) => c.createdAt)
      .filter(Boolean)
      .sort()[0] as string | undefined;

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

    const calc = calculateProgressionFromContributions({
      memberId: doc.id,
      contributions: progressionInputs,
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

    // Fresh-epoch view for "what would refresh produce if we used persisted epoch"
    // Also compute from epoch=null (membership start) as deploy-fresh baseline
    const calcFresh = calculateProgressionFromContributions({
      memberId: doc.id,
      contributions: progressionInputs,
      membershipStart: createdMonth,
      asOf,
      defaulterThresholdMonths: 2,
      postMaturityResetMonths: 6,
      existingMaturityDate: null,
      existingProgressionEpoch: null,
      existingResetCount: 0,
      existingLastProgressionResetAt: null,
    });

    const useCalc = calcFresh; // planned refresh typically recalculates with persisted epoch from store after first write; for impact use persisted epoch when present else fresh
    // For impact of "controlled refresh", engine loads existing epoch from progression doc.
    // So primary comparison uses `calc` (with persisted epoch metadata).
    const primary = calc;

    const augustKey = "2026-08";
    const hasAugustPaid = paidMonths.includes(augustKey);
    const augustIsObligation =
      cmp(createdMonth, { year: 2026, month: 8 }) <= 0 &&
      cmp(asOf, { year: 2026, month: 8 }) >= 0 &&
      cmp(createdMonth, { year: 2026, month: 8 }) === 0
        ? true
        : cmp(createdMonth, { year: 2026, month: 8 }) < 0;
    // For August intake members (start Aug): August is obligation
    const augustOutstandingForMember =
      createdMonth.year === 2026 &&
      createdMonth.month === 8 &&
      !hasAugustPaid;
    const augustPaidForMember =
      createdMonth.year === 2026 &&
      createdMonth.month === 8 &&
      hasAugustPaid;

    if (augustOutstandingForMember) {
      augustOutstanding += 1;
      augustMissing += 1;
    }
    if (augustPaidForMember) augustPaid += 1;

    // July must not be outstanding when start is August
    const julyInOutstanding = primary.outstandingMonths.some(
      (m) => m.year === 2026 && m.month === 7,
    );

    // Open month violation: Sep counted in consecutiveMissedMonths
    const sepCountedAsCompletedMiss =
      asOf.month === 9 &&
      asOf.year === 2026 &&
      primary.consecutiveMissedMonths > 0 &&
      !hasAugustPaid === false &&
      // If only Sep unpaid and streak > 0 with start Aug — would mean Sep counted
      primary.outstandingMonths.length === 1 &&
      primary.outstandingMonths[0]?.month === 9 &&
      primary.consecutiveMissedMonths >= 1;

    // Better check: if consecutiveMissed includes open month incorrectly —
    // when asOf=Sep and only Sep unpaid after Aug paid, streak must be 0
    if (
      asOf.year === 2026 &&
      asOf.month === 9 &&
      hasAugustPaid &&
      !paidMonths.includes("2026-09") &&
      primary.consecutiveMissedMonths !== 0
    ) {
      openMonthViolation += 1;
    }
    if (
      asOf.year === 2026 &&
      asOf.month === 9 &&
      createdMonth.month === 8 &&
      createdMonth.year === 2026 &&
      !hasAugustPaid &&
      !paidMonths.includes("2026-09") &&
      primary.consecutiveMissedMonths !== 0
    ) {
      // Aug grace + Sep open → streak must be 0
      openMonthViolation += 1;
    }

    const persistedOutstanding =
      typeof persisted?.outstandingContributionMonths === "number"
        ? persisted.outstandingContributionMonths
        : Array.isArray(persisted?.outstandingMonths)
          ? (persisted!.outstandingMonths as unknown[]).length
          : null;
    const persistedStatus = (persisted?.membershipStatus as string) ?? null;
    const persistedPoints =
      typeof persisted?.welfarePoints === "number"
        ? persisted.welfarePoints
        : null;
    const persistedMissed =
      typeof persisted?.consecutiveMissedMonths === "number"
        ? persisted.consecutiveMissedMonths
        : null;
    const persistedSuccessful =
      typeof persisted?.successfulContributionMonths === "number"
        ? persisted.successfulContributionMonths
        : null;
    const persistedEpoch = epochInput;
    const persistedResetCount =
      typeof persisted?.resetCount === "number" ? persisted.resetCount : null;

    const usersIsDefaulter = Boolean(u.isDefaulter);
    const usersConsecutive =
      typeof u.consecutiveUnpaidMonths === "number"
        ? u.consecutiveUnpaidMonths
        : null;

    const diffs: string[] = [];
    if (persistedOutstanding !== primary.outstandingContributionMonths) {
      diffs.push(
        `outstandingContributionMonths: persisted=${persistedOutstanding} calc=${primary.outstandingContributionMonths}`,
      );
    }
    if (persistedPoints !== primary.welfarePoints) {
      diffs.push(
        `welfarePoints: persisted=${persistedPoints} calc=${primary.welfarePoints}`,
      );
    }
    if (persistedSuccessful !== primary.successfulContributionMonths) {
      diffs.push(
        `successfulContributionMonths: persisted=${persistedSuccessful} calc=${primary.successfulContributionMonths}`,
      );
    }
    if (persistedMissed !== primary.consecutiveMissedMonths) {
      diffs.push(
        `consecutiveMissedMonths: persisted=${persistedMissed} calc=${primary.consecutiveMissedMonths}`,
      );
    }
    if (persistedStatus !== primary.membershipStatus) {
      diffs.push(
        `membershipStatus: persisted=${persistedStatus} calc=${primary.membershipStatus}`,
      );
    }
    if (usersIsDefaulter !== (primary.membershipStatus === "DEFAULTING")) {
      diffs.push(
        `isDefaulter: persisted=${usersIsDefaulter} calc=${primary.membershipStatus === "DEFAULTING"}`,
      );
    }
    if (
      (persistedResetCount ?? 0) !== primary.resetCount &&
      primary.didReset === false
    ) {
      // only note if calc would change resetCount without this being a new reset from fresh
    }
    if (primary.didReset) {
      diffs.push(`wouldReset=true resetCount→${primary.resetCount}`);
    }

    const epochPersistedKey = persistedEpoch
      ? keyOf(persistedEpoch)
      : null;
    const epochCalcKey = keyOf(primary.progressionEpochMonth);
    if (epochPersistedKey !== epochCalcKey && (persistedEpoch || primary.didReset)) {
      diffs.push(
        `progressionEpochMonth: persisted=${epochPersistedKey} calc=${epochCalcKey}`,
      );
    }

    let classification:
      | "IN_SYNC"
      | "STALE_SAFE_TO_REFRESH"
      | "REQUIRES_MANUAL_REVIEW"
      | "SUSPICIOUS_DATA" = "IN_SYNC";

    if (suspicious) {
      classification = "SUSPICIOUS_DATA";
      manualReview += 1;
    } else if (julyInOutstanding) {
      classification = "REQUIRES_MANUAL_REVIEW";
      manualReview += 1;
    } else if (primary.didReset) {
      classification = "REQUIRES_MANUAL_REVIEW";
      manualReview += 1;
      wouldReset += 1;
    } else if (diffs.length > 0) {
      classification = "STALE_SAFE_TO_REFRESH";
      staleCount += 1;
    } else {
      inSync += 1;
    }

    // Focus rows: affected cohorts or diffs or Marian
    const isAffected =
      isAugCreated ||
      isSepCreated ||
      diffs.length > 0 ||
      suspicious ||
      hasJulyPaid ||
      u.serviceNumber === "IS/13022";

    if (!isAffected) continue;

    rows.push({
      name: u.fullName,
      serviceNumber: u.serviceNumber,
      memberId: doc.id,
      createdAt: createdAtIso,
      activatedAt: activatedAtIso,
      membershipStartMonth: keyOf(createdMonth),
      paidMonths,
      outstandingMonths: primary.outstandingMonths.map(keyOf),
      outstandingCount: primary.outstandingContributionMonths,
      completedMissedStreak: primary.consecutiveMissedMonths,
      openMonth: keyOf(asOf),
      openMonthPaid: paidMonths.includes(keyOf(asOf)),
      welfarePoints: primary.welfarePoints,
      successfulContributionMonths: primary.successfulContributionMonths,
      isMature: primary.isMature,
      membershipStatus: primary.membershipStatus,
      isDefaulter: primary.membershipStatus === "DEFAULTING",
      progressionEpoch: keyOf(primary.progressionEpochMonth),
      wouldReset: primary.didReset,
      resetThreshold: primary.isMature && !primary.didReset ? 6 : 2,
      // after reset isMature false so threshold display: use pre-reset maturity
      resetThresholdApplicable: calcFresh.isMature || (persisted?.isMature === true && !primary.didReset) ? 6 : 2,
      joiningMonthGraceApplies: true,
      hasJulyPaid,
      julyInOutstanding,
      firstContributionAt: firstContribution ?? null,
      memberSince: createdAtIso,
      classification,
      suspiciousReason,
      diffs,
      persisted: {
        outstandingContributionMonths: persistedOutstanding,
        welfarePoints: persistedPoints,
        successfulContributionMonths: persistedSuccessful,
        consecutiveMissedMonths: persistedMissed,
        membershipStatus: persistedStatus,
        isDefaulter: usersIsDefaulter,
        consecutiveUnpaidMonths: usersConsecutive,
        progressionEpochMonth: epochPersistedKey,
        resetCount: persistedResetCount,
        isMature: persisted?.isMature ?? null,
      },
    });
  }

  // Fix wouldReset double-count: recount from rows
  const wouldResetMembers = rows.filter((r) => r.wouldReset === true);
  const marian = rows.find((r) => r.serviceNumber === "IS/13022");

  // Recompute cohort counts for wouldReset uniquely
  const wouldResetUnique = new Set(
    wouldResetMembers.map((r) => r.memberId as string),
  );

  // Defaulting buckets among all reviewed (recompute quickly from rows + need full pop)
  // Re-scan for buckets using primary calc on all users — store light stats
  let preMat1 = 0;
  let preMat2 = 0;
  let mature5 = 0;
  let mature6 = 0;
  let zeroProgressDefaulting = 0;

  for (const r of rows) {
    const streak = r.completedMissedStreak as number;
    const mature = r.isMature as boolean;
    const points = r.welfarePoints as number;
    if (!mature && streak === 1) preMat1 += 1;
    if (!mature && streak >= 2) preMat2 += 1;
    if (mature && streak === 5) mature5 += 1;
    if (mature && streak >= 6) mature6 += 1;
    if (points === 0 && streak >= 1) zeroProgressDefaulting += 1;
  }

  const report = {
    asOf,
    population: {
      totalMembersReviewed: usersSnap.size,
      createdOnOrAfterAug7,
      activatedAfterCreation,
      augCreatedSepActivated,
      sepCreatedSepActivated,
      augCreatedNotActivated,
      suspiciousCreatedAt,
    },
    august: {
      augustPaid,
      augustOutstanding,
      julyManualPaidContributionsMembers: julyManual,
    },
    openMonthViolations: openMonthViolation,
    classification: {
      inSync,
      staleSafeToRefresh: staleCount,
      requiresManualReview: manualReview,
      // note: wouldReset counted during loop may double — use unique
      wouldResetOnRefreshWithPersistedEpoch: wouldResetUnique.size,
    },
    defaultingBucketsAmongAffectedRows: {
      preMaturity_1_completedMiss: preMat1,
      preMaturity_2plus_completedMiss: preMat2,
      mature_5_completedMiss: mature5,
      mature_6plus_completedMiss: mature6,
      zeroPointsWithCompletedMissStreak: zeroProgressDefaulting,
    },
    marianOwusu: marian ?? null,
    affectedMemberCount: rows.length,
    rows,
    financialSafety: {
      auditWrites: false,
      contributionWrites: false,
      paymentWrites: false,
      receiptWrites: false,
      userIdentityWrites: false,
      note: "This script only reads Firestore and computes in-memory.",
    },
  };

  // Console summary only (avoid dumping all PII if huge); write full JSON to temp outside repo? User said no writes - console only.
  // Writing to stdout is fine. Avoid writing files to be safe.
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
