import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLLECTIONS } from "@/lib/constants";
import {
  buildClaimActionUrl,
  buildContributionActionUrl,
  buildMemberClaimNotification,
  buildPaymentActionUrl,
  getNotificationActionLabel,
} from "@/lib/notifications/labels";
import {
  archiveNotification,
  getNotificationReadState,
  getUnreadNotificationCount,
  getRecentUnreadNotifications,
  isEventVisibleToUser,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications/repository";
import { resolveUserNotificationStatus } from "@/lib/notifications/read-repository";
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventStatus,
  NotificationEventType,
  NotificationModule,
  type NotificationEvent,
} from "@/lib/notifications/types";
import type { CurrentUser } from "@/types/auth";
import { UserRole } from "@/types/enums";

const mockCollection = vi.fn();
const mockDoc = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

const eventStore = new Map<string, Record<string, unknown>>();
const readStore = new Map<string, Record<string, unknown>>();

function makeTimestamp(iso: string) {
  const date = new Date(iso);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

function readDocId(userId: string, notificationId: string): string {
  return `${userId}__${notificationId}`;
}

function makeActor(
  uid: string,
  role: UserRole,
  overrides: Partial<CurrentUser> = {},
): CurrentUser {
  return {
    uid,
    fullName: overrides.fullName ?? uid,
    serviceNumber: overrides.serviceNumber ?? "IS/00000",
    role,
    profileCompleted: true,
    profileCompletionPercentage: 100,
    ...overrides,
  };
}

function seedEvent(id: string, overrides: Record<string, unknown> = {}) {
  eventStore.set(id, {
    eventType: NotificationEventType.PROFILE_PHONE_CHANGED,
    audience: NotificationAudience.EXECUTIVE,
    memberId: "member-1",
    memberName: "Mary Baah",
    serviceNumber: "IS/00001",
    actorId: "member-1",
    actorName: "Mary Baah",
    title: "Phone changed",
    message: "Mary Baah phone changed",
    relatedModule: NotificationModule.PROFILE,
    relatedRecordId: "member-1",
    actionUrl: "/admin/members/member-1",
    channels: [NotificationChannel.IN_APP],
    metadata: {},
    createdAt: makeTimestamp("2026-06-01T10:00:00.000Z"),
    updatedAt: makeTimestamp("2026-06-01T10:00:00.000Z"),
    ...overrides,
  });
}

function seedLegacyReadEvent(id: string) {
  seedEvent(id, {
    status: NotificationEventStatus.READ,
    readAt: makeTimestamp("2026-06-01T11:00:00.000Z"),
  });
}

function seedMemberClaimEvent(
  id: string,
  memberId: string,
  overrides: Record<string, unknown> = {},
) {
  seedEvent(id, {
    eventType: NotificationEventType.CLAIM_APPROVED,
    audience: NotificationAudience.MEMBER,
    memberId,
    memberName: "Mary Baah",
    serviceNumber: "IS/00001",
    title: "Claim Approved",
    message: "Claim CLM-001: Claim Approved.",
    relatedModule: NotificationModule.CLAIMS,
    relatedRecordId: "claim-1",
    actionUrl: buildClaimActionUrl("claim-1"),
    ...overrides,
  });
}

vi.mock("@/lib/firebase/admin", () => ({
  getAdminDb: () => ({
    collection: (name: string) => {
      mockCollection(name);

      if (name === COLLECTIONS.NOTIFICATION_EVENTS) {
        return {
          orderBy: (...args: unknown[]) => {
            mockOrderBy(...args);
            return {
              get: async () => {
                const docs = [...eventStore.entries()]
                  .map(([id, data]) => ({
                    id,
                    exists: true,
                    data: () => data,
                  }))
                  .sort((a, b) => {
                    const aMs =
                      (a.data().createdAt as { toDate: () => Date }).toDate().getTime();
                    const bMs =
                      (b.data().createdAt as { toDate: () => Date }).toDate().getTime();
                    return bMs - aMs;
                  });
                return { docs };
              },
            };
          },
          doc: (id: string) => {
            mockDoc(id);
            return {
              get: async () => {
                const data = eventStore.get(id);
                return {
                  exists: Boolean(data),
                  id,
                  data: () => data,
                };
              },
              set: async (payload: Record<string, unknown>) => {
                mockSet(payload);
                eventStore.set(id, payload);
              },
            };
          },
        };
      }

      if (name === COLLECTIONS.NOTIFICATION_READS) {
        return {
          where: (field: string, op: string, value: unknown) => {
            mockWhere(field, op, value);
            return {
              get: async () => ({
                docs: [...readStore.entries()]
                  .filter(([, data]) => data.userId === value)
                  .map(([id, data]) => ({
                    id,
                    exists: true,
                    data: () => data,
                  })),
              }),
            };
          },
          doc: (id: string) => {
            mockDoc(id);
            return {
              get: async () => {
                const data = readStore.get(id);
                return {
                  exists: Boolean(data),
                  id,
                  data: () => data,
                };
              },
              set: async (payload: Record<string, unknown>) => {
                mockSet(payload);
                readStore.set(id, payload);
              },
              update: async (payload: Record<string, unknown>) => {
                mockUpdate(payload);
                readStore.set(id, {
                  ...readStore.get(id),
                  ...payload,
                });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

describe("notification read-state isolation", () => {
  const admin = makeActor("admin-1", UserRole.ADMIN);
  const treasurer = makeActor("treasurer-1", UserRole.TREASURER);

  beforeEach(() => {
    eventStore.clear();
    readStore.clear();
    vi.clearAllMocks();
    seedEvent("notif-1");
  });

  it("defaults missing read state to unread for every executive", async () => {
    expect(await getUnreadNotificationCount(admin)).toBe(1);
    expect(await getUnreadNotificationCount(treasurer)).toBe(1);
  });

  it("keeps admin unread when treasurer marks a notification read", async () => {
    await markNotificationAsRead("notif-1", treasurer);

    expect(await getUnreadNotificationCount(treasurer)).toBe(0);
    expect(await getUnreadNotificationCount(admin)).toBe(1);

    const treasurerList = await listNotificationsForUser(treasurer, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });
    const adminList = await listNotificationsForUser(admin, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });

    expect(treasurerList.records[0]?.status).toBe(NotificationEventStatus.READ);
    expect(adminList.records[0]?.status).toBe(NotificationEventStatus.UNREAD);
  });

  it("isolates archive actions per user", async () => {
    await archiveNotification("notif-1", admin);

    expect(await getUnreadNotificationCount(admin)).toBe(0);
    expect(await getUnreadNotificationCount(treasurer)).toBe(1);

    const adminList = await listNotificationsForUser(admin, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });
    const treasurerList = await listNotificationsForUser(treasurer, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });

    expect(adminList.records[0]?.status).toBe(NotificationEventStatus.ARCHIVED);
    expect(treasurerList.records[0]?.status).toBe(NotificationEventStatus.UNREAD);
  });

  it("marks all notifications read only for the current user", async () => {
    seedEvent("notif-2");

    const updated = await markAllNotificationsAsRead(treasurer);
    expect(updated).toBe(2);

    expect(await getUnreadNotificationCount(treasurer)).toBe(0);
    expect(await getUnreadNotificationCount(admin)).toBe(2);
  });

  it("returns user-specific unread items for dashboard widgets", async () => {
    await markNotificationAsRead("notif-1", treasurer);

    const adminRecent = await getRecentUnreadNotifications(admin, 5);
    const treasurerRecent = await getRecentUnreadNotifications(treasurer, 5);

    expect(adminRecent).toHaveLength(1);
    expect(adminRecent[0]?.status).toBe(NotificationEventStatus.UNREAD);
    expect(treasurerRecent).toHaveLength(0);
  });

  it("ignores legacy global status on notification_events", async () => {
    eventStore.clear();
    seedLegacyReadEvent("legacy-notif");

    expect(resolveUserNotificationStatus(undefined)).toBe(
      NotificationEventStatus.UNREAD,
    );
    expect(await getUnreadNotificationCount(admin)).toBe(1);

    const list = await listNotificationsForUser(admin, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });
    expect(list.records[0]?.status).toBe(NotificationEventStatus.UNREAD);
  });

  it("stores read state in notification_reads keyed by user", async () => {
    await markNotificationAsRead("notif-1", treasurer);

    const readState = await getNotificationReadState("notif-1", treasurer.uid);
    expect(readState?.userId).toBe(treasurer.uid);
    expect(readState?.notificationId).toBe("notif-1");
    expect(readState?.status).toBe(NotificationEventStatus.READ);
    expect(readStore.has(readDocId(treasurer.uid, "notif-1"))).toBe(true);
    expect(readStore.has(readDocId(admin.uid, "notif-1"))).toBe(false);
  });
});

describe("unified notification centre scoping", () => {
  const memberA = makeActor("member-a", UserRole.MEMBER, {
    fullName: "Member A",
    serviceNumber: "IS/00010",
  });
  const memberB = makeActor("member-b", UserRole.MEMBER, {
    fullName: "Member B",
    serviceNumber: "IS/00011",
  });
  const admin = makeActor("admin-1", UserRole.ADMIN);

  beforeEach(() => {
    eventStore.clear();
    readStore.clear();
    vi.clearAllMocks();
  });

  it("creates member claim notifications with action links", () => {
    const payload = buildMemberClaimNotification({
      eventType: NotificationEventType.CLAIM_APPROVED,
      claimId: "claim-1",
      claimNumber: "CLM-001",
      memberId: memberA.uid,
      memberName: memberA.fullName,
      serviceNumber: memberA.serviceNumber,
      actorId: admin.uid,
      actorName: admin.fullName,
    });

    expect(payload.audience).toBe(NotificationAudience.MEMBER);
    expect(payload.relatedModule).toBe(NotificationModule.CLAIMS);
    expect(payload.actionUrl).toBe(buildClaimActionUrl("claim-1"));
    expect(payload.title).toBe("Claim Approved");
    expect(getNotificationActionLabel(payload.eventType, payload.relatedModule)).toBe(
      "View Claim",
    );
  });

  it("builds contribution and payment action links", () => {
    expect(buildContributionActionUrl("contrib-1")).toContain("highlight=contrib-1");
    expect(buildPaymentActionUrl()).toBe("/payments");
    expect(
      getNotificationActionLabel(
        NotificationEventType.CONTRIBUTION_RECEIVED,
        NotificationModule.CONTRIBUTIONS,
      ),
    ).toBe("View Contribution");
    expect(
      getNotificationActionLabel(
        NotificationEventType.PAYMENT_RECORDED,
        NotificationModule.PAYMENTS,
      ),
    ).toBe("View Payment");
  });

  it("lets members see only their own member-audience notifications", async () => {
    seedMemberClaimEvent("claim-a", memberA.uid);
    seedMemberClaimEvent("claim-b", memberB.uid, {
      memberName: "Member B",
      serviceNumber: "IS/00011",
    });
    seedEvent("exec-profile");

    const listA = await listNotificationsForUser(memberA, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });
    const listB = await listNotificationsForUser(memberB, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });

    expect(listA.records).toHaveLength(1);
    expect(listA.records[0]?.id).toBe("claim-a");
    expect(listB.records).toHaveLength(1);
    expect(listB.records[0]?.id).toBe("claim-b");
  });

  it("lets administrators view all notification delivery history", async () => {
    seedMemberClaimEvent("claim-a", memberA.uid);
    seedEvent("exec-profile");

    const adminList = await listNotificationsForUser(admin, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });

    expect(adminList.records.map((record) => record.id).sort()).toEqual([
      "claim-a",
      "exec-profile",
    ]);
  });

  it("updates member read status and mark-all-as-read", async () => {
    seedMemberClaimEvent("claim-a", memberA.uid, {
      createdAt: makeTimestamp("2026-06-02T10:00:00.000Z"),
    });
    seedMemberClaimEvent("claim-a-2", memberA.uid, {
      createdAt: makeTimestamp("2026-06-01T10:00:00.000Z"),
      relatedRecordId: "claim-2",
      actionUrl: buildClaimActionUrl("claim-2"),
    });

    expect(await getUnreadNotificationCount(memberA)).toBe(2);

    await markNotificationAsRead("claim-a", memberA);
    expect(await getUnreadNotificationCount(memberA)).toBe(1);

    const unreadOnly = await listNotificationsForUser(memberA, {
      page: 1,
      pageSize: 20,
      status: NotificationEventStatus.UNREAD,
      audience: "all",
    });
    expect(unreadOnly.records).toHaveLength(1);
    expect(unreadOnly.records[0]?.id).toBe("claim-a-2");

    const readOnly = await listNotificationsForUser(memberA, {
      page: 1,
      pageSize: 20,
      status: NotificationEventStatus.READ,
      audience: "all",
    });
    expect(readOnly.records).toHaveLength(1);
    expect(readOnly.records[0]?.id).toBe("claim-a");

    await markAllNotificationsAsRead(memberA);
    expect(await getUnreadNotificationCount(memberA)).toBe(0);
  });

  it("filters unread/read and sorts newest first", async () => {
    seedMemberClaimEvent("older", memberA.uid, {
      createdAt: makeTimestamp("2026-06-01T10:00:00.000Z"),
    });
    seedMemberClaimEvent("newer", memberA.uid, {
      createdAt: makeTimestamp("2026-06-03T10:00:00.000Z"),
      relatedRecordId: "claim-2",
    });

    const all = await listNotificationsForUser(memberA, {
      page: 1,
      pageSize: 20,
      status: "all",
      audience: "all",
    });
    expect(all.records.map((record) => record.id)).toEqual(["newer", "older"]);

    await markNotificationAsRead("newer", memberA);

    const unread = await listNotificationsForUser(memberA, {
      page: 1,
      pageSize: 20,
      status: NotificationEventStatus.UNREAD,
      audience: "all",
    });
    expect(unread.records.map((record) => record.id)).toEqual(["older"]);
  });

  it("exposes header unread count for members", async () => {
    seedMemberClaimEvent("claim-a", memberA.uid);
    seedMemberClaimEvent("claim-other", memberB.uid);

    expect(await getUnreadNotificationCount(memberA)).toBe(1);
    expect(await getUnreadNotificationCount(memberB)).toBe(1);

    const recent = await getRecentUnreadNotifications(memberA, 5);
    expect(recent).toHaveLength(1);
    expect(recent[0]?.actionUrl).toBe(buildClaimActionUrl("claim-1"));
  });

  it("blocks members from marking another member's notification read", async () => {
    seedMemberClaimEvent("claim-b", memberB.uid);

    await expect(markNotificationAsRead("claim-b", memberA)).rejects.toThrow(
      /permission/i,
    );
  });

  it("classifies visibility by audience and membership", () => {
    const memberEvent = {
      id: "1",
      audience: NotificationAudience.MEMBER,
      memberId: memberA.uid,
    } as NotificationEvent;
    const executiveEvent = {
      id: "2",
      audience: NotificationAudience.EXECUTIVE,
      memberId: memberA.uid,
    } as NotificationEvent;

    expect(isEventVisibleToUser(memberEvent, memberA)).toBe(true);
    expect(isEventVisibleToUser(executiveEvent, memberA)).toBe(false);
    expect(isEventVisibleToUser(memberEvent, admin)).toBe(true);
    expect(isEventVisibleToUser(executiveEvent, admin)).toBe(true);
  });
});
