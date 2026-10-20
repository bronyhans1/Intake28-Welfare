/**
 * READ-ONLY audit: latest announcement + related notification_events.
 * Stdout JSON only. No writes.
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

function toIso(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v) {
    return v.toDate().toISOString();
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

async function main() {
  const [announcementsSnap, notificationsSnap, usersSnap] = await Promise.all([
    db.collection("announcements").orderBy("createdAt", "desc").limit(5).get(),
    db.collection("notification_events").orderBy("createdAt", "desc").limit(200).get(),
    db.collection("users").where("role", "in", ["admin", "member", "treasurer"]).limit(500).get(),
  ]);

  const announcements = announcementsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const latest = announcements[0] ?? null;
  const latestId = latest?.id;

  const allNotifications = notificationsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const announcementNotifications = latestId
    ? allNotifications.filter(
        (n) =>
          n.eventType === "announcement_published" &&
          n.relatedRecordId === latestId,
      )
    : [];

  const recentAnnouncementNotifications = allNotifications.filter(
    (n) => n.eventType === "announcement_published",
  );

  const recentWorkingNotifications = allNotifications
    .filter((n) =>
      ["contribution_received", "payment_recorded", "receipt_generated"].includes(
        String(n.eventType),
      ),
    )
    .slice(0, 5);

  const usersByRole = {
    admin: 0,
    member: 0,
    treasurer: 0,
  };
  for (const doc of usersSnap.docs) {
    const role = String(doc.data().role);
    if (role in usersByRole) usersByRole[role] += 1;
  }

  const memberAudienceCount = announcementNotifications.filter(
    (n) => n.audience === "member",
  ).length;
  const executiveAudienceCount = announcementNotifications.filter(
    (n) => n.audience === "executive",
  ).length;

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        latestAnnouncements: announcements.map((a) => ({
          id: a.id,
          title: a.title,
          message: typeof a.message === "string" ? a.message.slice(0, 120) : a.message,
          audience: a.audience,
          status: a.status,
          createdBy: a.createdBy,
          createdByName: a.createdByName,
          createdAt: toIso(a.createdAt),
          publishedAt: toIso(a.publishedAt),
          expiresAt: toIso(a.expiresAt),
        })),
        latestAnnouncement: latest
          ? {
              id: latest.id,
              title: latest.title,
              audience: latest.audience,
              status: latest.status,
              createdBy: latest.createdBy,
              createdByName: latest.createdByName,
              createdAt: toIso(latest.createdAt),
              publishedAt: toIso(latest.publishedAt),
            }
          : null,
        notificationsForLatestAnnouncement: {
          total: announcementNotifications.length,
          memberAudience: memberAudienceCount,
          executiveAudience: executiveAudienceCount,
          sample: announcementNotifications.slice(0, 5).map((n) => ({
            id: n.id,
            eventType: n.eventType,
            audience: n.audience,
            memberId: n.memberId,
            memberName: n.memberName,
            title: n.title,
            message: n.message,
            relatedRecordId: n.relatedRecordId,
            actionUrl: n.actionUrl,
            metadata: n.metadata ?? null,
            createdAt: toIso(n.createdAt),
          })),
        },
        recentAnnouncementPublishedEvents: recentAnnouncementNotifications
          .slice(0, 10)
          .map((n) => ({
            id: n.id,
            relatedRecordId: n.relatedRecordId,
            audience: n.audience,
            memberId: n.memberId,
            memberName: n.memberName,
            createdAt: toIso(n.createdAt),
            message: n.message,
          })),
        recentWorkingNotifications: recentWorkingNotifications.map((n) => ({
          id: n.id,
          eventType: n.eventType,
          audience: n.audience,
          memberId: n.memberId,
          memberName: n.memberName,
          createdAt: toIso(n.createdAt),
        })),
        userRoleCountsSample: usersByRole,
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
