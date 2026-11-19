/**
 * READ-ONLY: classify stale progression members + August not-yet-activated.
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

function toIso(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return v.toDate().toISOString();
  }
  return String(v);
}

function monthFromIso(iso) {
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

function cmp(a, b) {
  if (a.year !== b.year) return a.year - b.year;
  return a.month - b.month;
}

function next(p) {
  return p.month >= 12
    ? { month: 1, year: p.year + 1 }
    : { month: p.month + 1, year: p.year };
}

function monthsBetween(start, end) {
  const out = [];
  let c = { ...start };
  while (cmp(c, end) <= 0) {
    out.push({ ...c });
    c = next(c);
  }
  return out;
}

function key(p) {
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

function statusFromOutstanding(n) {
  if (n >= 6) return "LAPSED";
  if (n >= 2) return "DEFAULTING";
  return "ACTIVE";
}

function benefit(points) {
  const p = Math.max(0, Math.floor(points));
  if (p < 6) return 0;
  return Math.min(100, Math.floor(25 + (p - 6) * 2.5));
}

loadEnvFile(".env.local");
loadEnvFile(".env");

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
const asOf = monthFromIso(new Date().toISOString());

async function main() {
  const [usersSnap, contribSnap, progSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("contributions").get(),
    db.collection("membership_progressions").get(),
  ]);

  const paidByMember = new Map();
  const allContribByMember = new Map();
  for (const doc of contribSnap.docs) {
    const c = doc.data();
    if (!allContribByMember.has(c.memberId)) allContribByMember.set(c.memberId, []);
    allContribByMember.get(c.memberId).push(c);
    if (c.contributionType !== "monthly_dues" || c.status !== "paid") continue;
    const m = Number(c.month);
    const y = Number(c.year);
    if (!Number.isFinite(m) || !Number.isFinite(y) || m < 1 || m > 12) continue;
    if (!paidByMember.has(c.memberId)) paidByMember.set(c.memberId, new Set());
    paidByMember.get(c.memberId).add(key({ month: m, year: y }));
  }

  const progressionById = new Map(progSnap.docs.map((d) => [d.id, d.data()]));

  let notActivatedAug = 0;
  let notActivatedAugProgCount = 0;
  const notActivatedAugSamples = [];
  const rows = [];

  for (const doc of usersSnap.docs) {
    const u = doc.data();
    const created = monthFromIso(toIso(u.createdAt));
    const activated = monthFromIso(toIso(u.activatedAt));

    if (created && created.year === 2026 && created.month === 8 && !u.activatedAt) {
      notActivatedAug += 1;
      const paid = paidByMember.get(doc.id) ?? new Set();
      const live = monthsBetween(created, asOf).filter((p) => !paid.has(key(p)));
      const p = progressionById.get(doc.id);
      if (p) notActivatedAugProgCount += 1;
      if (notActivatedAugSamples.length < 5) {
        notActivatedAugSamples.push({
          name: u.fullName,
          serviceNumber: u.serviceNumber,
          liveOutstandingCount: live.length,
          persistedOutstanding: p?.outstandingContributionMonths ?? null,
          persistedStatus: p?.membershipStatus ?? null,
          activationStatus: u.activationStatus,
        });
      }
    }

    if (!created || !activated || cmp(created, activated) >= 0) continue;

    const paid = paidByMember.get(doc.id) ?? new Set();
    const live = monthsBetween(created, asOf).filter((p) => !paid.has(key(p)));
    const p = progressionById.get(doc.id);
    const persisted =
      typeof p?.outstandingContributionMonths === "number"
        ? p.outstandingContributionMonths
        : Array.isArray(p?.outstandingMonths)
          ? p.outstandingMonths.length
          : null;

    if (persisted === null || persisted !== live.length) {
      const afterStatus = statusFromOutstanding(live.length);
      const points = typeof p?.welfarePoints === "number" ? p.welfarePoints : [...paid].filter((k) => {
        const [y, m] = k.split("-").map(Number);
        return cmp({ year: y, month: m }, asOf) <= 0;
      }).length;
      const afterBenefit = benefit(points);
      const afterMature = points >= 6;
      const afterEligible = afterMature && afterStatus === "ACTIVE";

      rows.push({
        name: u.fullName,
        serviceNumber: u.serviceNumber,
        createdMonth: created,
        activatedMonth: activated,
        paidMonths: [...paid].sort(),
        liveOutstanding: live,
        liveCount: live.length,
        persistedCount: persisted,
        persistedStatus: p?.membershipStatus ?? null,
        afterRecalcStatus: afterStatus,
        welfarePointsPersisted: p?.welfarePoints ?? null,
        welfarePointsExpected: points,
        benefitPersisted: p?.benefitPercentage ?? null,
        benefitExpected: afterBenefit,
        isMaturePersisted: p?.isMature ?? null,
        eligiblePersisted: p?.eligibleToClaim ?? null,
        eligibleExpected: afterEligible,
        A_remainActive: afterStatus === "ACTIVE",
        B_becomeDefaulting:
          afterStatus === "DEFAULTING" && p?.membershipStatus !== "DEFAULTING",
        C_becomeLapsed: afterStatus === "LAPSED" && p?.membershipStatus !== "LAPSED",
        D_triggerReset: false,
        E_claimEligChange: Boolean(p?.eligibleToClaim) !== afterEligible,
        F_benefitChange: (p?.benefitPercentage ?? null) !== afterBenefit,
        G_pointsChange: (p?.welfarePoints ?? null) !== points,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        asOf,
        staleCount: rows.length,
        summary: {
          remainActive: rows.filter((r) => r.A_remainActive).length,
          becomeDefaulting: rows.filter((r) => r.B_becomeDefaulting).length,
          becomeLapsed: rows.filter((r) => r.C_becomeLapsed).length,
          triggerReset: 0,
          claimEligChange: rows.filter((r) => r.E_claimEligChange).length,
          benefitChange: rows.filter((r) => r.F_benefitChange).length,
          pointsChange: rows.filter((r) => r.G_pointsChange).length,
        },
        rows,
        notActivatedAugustMembers: notActivatedAug,
        notActivatedAugustWithProgression: notActivatedAugProgCount,
        notActivatedAugSamples,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ error: String(e) }));
  process.exit(1);
});
