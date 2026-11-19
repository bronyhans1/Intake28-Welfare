/**
 * READ-ONLY: fetch active constitution text snippets related to default/lapse.
 * No writes.
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
const KEYWORDS =
  /default|lapse|lapsed|consecut|missed|unpaid|contribu|month|mature|reset|arrear|period/i;

async function main() {
  const snap = await db.collection("constitutions").get();
  const settings = await db.collection("system").doc("settings").get();
  const versions = snap.docs.map((d) => {
    const data = d.data();
    const textFields = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "string" && v.length > 0) textFields[k] = v;
    }
    const blob = JSON.stringify(data);
    const hits = [];
    // Extract sentences-ish containing keywords from all string fields
    for (const [k, v] of Object.entries(textFields)) {
      if (!KEYWORDS.test(v) && !KEYWORDS.test(k)) continue;
      const excerpts = v
        .split(/(?<=[.!?])\s+|\n+/)
        .filter((s) => KEYWORDS.test(s))
        .slice(0, 40);
      if (excerpts.length || KEYWORDS.test(k)) {
        hits.push({
          field: k,
          length: v.length,
          excerpts: excerpts.length ? excerpts : [v.slice(0, 500)],
        });
      }
    }
    return {
      id: d.id,
      status: data.status ?? null,
      displayName: data.displayName ?? data.title ?? null,
      versionNumber: data.versionNumber ?? null,
      description: typeof data.description === "string" ? data.description : null,
      notes: typeof data.notes === "string" ? data.notes : null,
      documentRef: data.documentRef ?? null,
      effectiveFrom: data.effectiveFrom ?? null,
      keys: Object.keys(data),
      hits,
    };
  });

  console.log(
    JSON.stringify(
      {
        settings: settings.exists
          ? {
              defaulterThresholdMonths: settings.data()?.defaulterThresholdMonths,
              monthlyDuesAmount: settings.data()?.monthlyDuesAmount,
            }
          : null,
        constitutionCount: versions.length,
        versions,
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
