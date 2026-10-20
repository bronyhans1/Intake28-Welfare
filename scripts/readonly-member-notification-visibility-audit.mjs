/**
 * READ-ONLY: simulate member notification visibility for announcement vs payment.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ANN_ID = "ZCtJYNO0Ug93tIZ7Ikv8";

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
  if (typeof v === "object" && v !== null && "toDate" in v) return v.toDate().toISOString();
  return String(v);
}

function resolveAudience(value) {
  return value === "member" ? "member" : "executive";
}

function resolveReadStatus(readState) {
  if (!readState) return "unread";
  return readState.status ?? "unread";
}

function isVisibleToMember(event, memberId) {
  return resolveAudience(event.audience) === "member" && event.memberId === memberId;
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
  const [eventsSnap, readsSnap, usersSnap] = await Promise.all([
    db.collection("notification_events").orderBy("createdAt", "desc").get(),
    db.collection("notification_reads").get(),
    db.collection("users").where("role", "==", "member").limit(500).get(),
  ]);

  const allEvents = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const readByUser = new Map();
  for (const doc of readsSnap.docs) {
    const row = doc.data();
    if (!readByUser.has(row.userId)) readByUser.set(row.userId, new Map());
    readByUser.get(row.userId).set(row.notificationId, row);
  }

  const annMemberEvents = allEvents.filter(
    (e) => e.eventType === "announcement_published" && e.relatedRecordId === ANN_ID && e.audience === "member",
  );

  const sampleMembers = annMemberEvents.slice(0, 5).map((e) => ({
    memberId: e.memberId,
    memberName: e.memberName,
    notificationId: e.id,
  }));

  const memberSimulations = [];

  for (const sample of sampleMembers) {
    const memberId = sample.memberId;
    const readStates = readByUser.get(memberId) ?? new Map();

    const visible = allEvents.filter((e) => isVisibleToMember(e, memberId));
    const unreadVisible = visible.filter(
      (e) => resolveReadStatus(readStates.get(e.id)) === "unread",
    );
    const annNotif = annMemberEvents.find((e) => e.memberId === memberId);
    const annReadState = annNotif ? readStates.get(annNotif.id) : null;

    const paymentNotifs = visible.filter((e) =>
      ["contribution_received", "payment_recorded", "receipt_generated"].includes(String(e.eventType)),
    );
    const recentUnreadTop5 = unreadVisible.slice(0, 5).map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: toIso(e.createdAt),
    }));

    const userDoc = usersSnap.docs.find((d) => d.id === memberId);
    const userData = userDoc?.data() ?? null;

    memberSimulations.push({
      memberId,
      memberName: sample.memberName,
      userExists: Boolean(userDoc),
      userRole: userData?.role ?? null,
      userStatus: userData?.status ?? null,
      announcementNotification: annNotif
        ? {
            id: annNotif.id,
            audience: annNotif.audience,
            eventType: annNotif.eventType,
            memberId: annNotif.memberId,
            createdAt: toIso(annNotif.createdAt),
            relatedRecordId: annNotif.relatedRecordId,
            actionUrl: annNotif.actionUrl,
            channels: annNotif.channels,
            readState: annReadState
              ? { status: annReadState.status, readAt: toIso(annReadState.readAt) }
              : null,
            consideredUnread: resolveReadStatus(annReadState) === "unread",
            visibleToMemberQuery: isVisibleToMember(annNotif, memberId),
            includedInUnreadCount: unreadVisible.some((e) => e.id === annNotif.id),
            includedInRecentTop5: recentUnreadTop5.some((e) => e.id === annNotif.id),
          }
        : null,
      simulatedUnreadCount: unreadVisible.length,
      simulatedRecentUnreadTop5: recentUnreadTop5,
      paymentNotificationCountVisible: paymentNotifs.length,
      paymentUnreadCount: paymentNotifs.filter(
        (e) => resolveReadStatus(readStates.get(e.id)) === "unread",
      ).length,
    });
  }

  const francisId = "WCpx9yvKyCr4HtaI5H71";
  const francisAnn = annMemberEvents.find((e) => e.memberId === francisId);
  const francisReads = readByUser.get(francisId) ?? new Map();
  const francisVisible = allEvents.filter((e) => isVisibleToMember(e, francisId));
  const francisUnread = francisVisible.filter(
    (e) => resolveReadStatus(francisReads.get(e.id)) === "unread",
  );

  const workingPayment = allEvents.find(
    (e) =>
      e.memberId === francisId &&
      e.eventType === "payment_recorded" &&
      e.audience === "member",
  );

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        announcementId: ANN_ID,
        totalNotificationEvents: allEvents.length,
        totalAnnouncementMemberNotifications: annMemberEvents.length,
        readStateAggregate: (() => {
          let unread = 0;
          let read = 0;
          let archived = 0;
          for (const e of annMemberEvents) {
            const st = readByUser.get(e.memberId)?.get(e.id)?.status;
            if (!st || st === "unread") unread += 1;
            else if (st === "read") read += 1;
            else if (st === "archived") archived += 1;
          }
          return { unread, read, archived };
        })(),
        sampleMemberSimulations: memberSimulations,
        francisYeboahDeepDive: {
          memberId: francisId,
          announcementNotification: francisAnn
            ? {
                id: francisAnn.id,
                fields: {
                  audience: francisAnn.audience,
                  eventType: francisAnn.eventType,
                  memberId: francisAnn.memberId,
                  title: francisAnn.title,
                  message: francisAnn.message,
                  createdAt: toIso(francisAnn.createdAt),
                  channels: francisAnn.channels,
                  relatedRecordId: francisAnn.relatedRecordId,
                },
                readState: francisReads.get(francisAnn.id) ?? "absent (defaults unread)",
                queryEligible: isVisibleToMember(francisAnn, francisId),
                inUnreadCount: francisUnread.some((e) => e.id === francisAnn.id),
                rankAmongUnread: francisUnread.findIndex((e) => e.id === francisAnn.id) + 1,
                totalUnreadForFrancis: francisUnread.length,
              }
            : null,
          workingPaymentNotification: workingPayment
            ? {
                id: workingPayment.id,
                eventType: workingPayment.eventType,
                audience: workingPayment.audience,
                memberId: workingPayment.memberId,
                createdAt: toIso(workingPayment.createdAt),
                readState: francisReads.get(workingPayment.id) ?? "absent (defaults unread)",
                queryEligible: isVisibleToMember(workingPayment, francisId),
                inUnreadCount: francisUnread.some((e) => e.id === workingPayment.id),
              }
            : "none found for francis",
        },
        fieldComparison:
          francisAnn && workingPayment
            ? {
                announcement: {
                  audience: francisAnn.audience,
                  eventType: francisAnn.eventType,
                  memberId: francisAnn.memberId,
                  hasChannels: Array.isArray(francisAnn.channels),
                },
                payment: {
                  audience: workingPayment.audience,
                  eventType: workingPayment.eventType,
                  memberId: workingPayment.memberId,
                  hasChannels: Array.isArray(workingPayment.channels),
                },
                structuralDifference:
                  francisAnn.audience === workingPayment.audience &&
                  francisAnn.memberId === workingPayment.memberId
                    ? "Same audience/memberId pattern — visibility rules identical"
                    : "Different routing fields",
              }
            : null,
        membersWithZeroUnreadIncludingAnnouncement: memberSimulations.filter(
          (m) => m.announcementNotification && !m.announcementNotification.includedInUnreadCount,
        ).length,
        membersWithAnnouncementOutsideTop5: memberSimulations.filter(
          (m) =>
            m.announcementNotification?.includedInUnreadCount &&
            !m.announcementNotification?.includedInRecentTop5,
        ).length,
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
