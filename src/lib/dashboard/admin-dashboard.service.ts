import { COLLECTIONS } from "@/lib/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { serializeFirestoreDoc } from "@/lib/firestore/serialize";
import { resolveAuditActorDisplayName } from "@/lib/audit/actor";
import { MemberAuditAction } from "@/lib/members/audit";
import { ActivationStatus, UserStatus } from "@/types/enums";
import type { User } from "@/types/user";

export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  pendingActivation: number;
  suspendedMembers: number;
}

export interface RecentMemberSummary {
  id: string;
  fullName: string;
  serviceNumber: string;
  role: string;
  status: string;
  activationStatus: string;
  createdAt: string;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  label: string;
  entityId: string;
  actorId: string;
  actorName: string;
  role: string;
  /** @deprecated Use actorId */
  performedBy: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const MEMBER_ACTIVITY_ACTIONS = new Set<string>([
  MemberAuditAction.MEMBER_CREATED,
  MemberAuditAction.MEMBER_UPDATED,
  MemberAuditAction.STATUS_CHANGED,
  MemberAuditAction.ACTIVATION_RESET,
]);

const ACTIVITY_LABELS: Record<string, string> = {
  [MemberAuditAction.MEMBER_CREATED]: "Member created",
  [MemberAuditAction.MEMBER_UPDATED]: "Member updated",
  [MemberAuditAction.STATUS_CHANGED]: "Status changed",
  [MemberAuditAction.ACTIVATION_RESET]: "Activation reset",
};

function mapFirestoreUser(id: string, data: Record<string, unknown>): User {
  return { id, ...data } as User;
}

function serializeRecentMember(user: User): RecentMemberSummary {
  const { id, ...data } = user;
  const serialized = serializeFirestoreDoc<Record<string, unknown>>(
    id,
    data as Record<string, unknown>,
  );

  return {
    id,
    fullName: String(serialized.fullName ?? user.fullName),
    serviceNumber: String(serialized.serviceNumber ?? user.serviceNumber),
    role: String(serialized.role ?? user.role),
    status: String(serialized.status ?? user.status),
    activationStatus: String(serialized.activationStatus ?? user.activationStatus),
    createdAt: String(serialized.createdAt ?? ""),
  };
}

async function fetchAllUsers(): Promise<User[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map((doc) =>
    mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>),
  );
}

function computeMemberStats(users: User[]): MemberStats {
  return {
    totalMembers: users.length,
    activeMembers: users.filter((user) => user.status === UserStatus.ACTIVE).length,
    pendingActivation: users.filter(
      (user) => user.activationStatus === ActivationStatus.PENDING,
    ).length,
    suspendedMembers: users.filter((user) => user.status === UserStatus.SUSPENDED)
      .length,
  };
}

function buildMemberNameMap(
  users: User[],
): Map<string, { fullName: string; serviceNumber: string }> {
  const map = new Map<string, { fullName: string; serviceNumber: string }>();
  for (const user of users) {
    map.set(user.id, {
      fullName: String(user.fullName ?? "Unknown member"),
      serviceNumber: String(user.serviceNumber ?? "—"),
    });
  }
  return map;
}

export interface AdminMemberOverview {
  stats: MemberStats;
  recentMembers: RecentMemberSummary[];
  /** Shared identity map for progression insights / activity name resolution. */
  memberNames: Map<string, { fullName: string; serviceNumber: string }>;
}

/**
 * Single users collection read for admin dashboard member widgets.
 * Derives stats, recent members, and a name map without repeat downloads.
 */
export async function getAdminMemberOverview(
  recentLimit = 10,
): Promise<AdminMemberOverview> {
  const users = await fetchAllUsers();
  return {
    stats: computeMemberStats(users),
    recentMembers: users.slice(0, recentLimit).map(serializeRecentMember),
    memberNames: buildMemberNameMap(users),
  };
}

export async function getMemberStats(): Promise<MemberStats> {
  const users = await fetchAllUsers();
  return computeMemberStats(users);
}

export async function getRecentMembers(
  limit = 10,
): Promise<RecentMemberSummary[]> {
  const users = await fetchAllUsers();
  return users.slice(0, limit).map(serializeRecentMember);
}

export async function getRecentActivity(
  limit = 10,
  options: {
    sessionUserFullName?: string | null;
    /** When provided, avoids per-log user document lookups for missing actorName. */
    knownActorNames?: Map<string, string>;
  } = {},
): Promise<RecentActivityItem[]> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(COLLECTIONS.AUDIT_LOGS)
    .orderBy("createdAt", "desc")
    .limit(limit * 3)
    .get();

  const items: RecentActivityItem[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const action = String(data.action ?? "");

    if (data.entityType !== "user" || !MEMBER_ACTIVITY_ACTIONS.has(action)) {
      continue;
    }

    const serialized = serializeFirestoreDoc<Record<string, unknown>>(
      doc.id,
      data as Record<string, unknown>,
    );

    const actorId =
      typeof serialized.actorId === "string"
        ? serialized.actorId
        : typeof serialized.performedBy === "string"
          ? serialized.performedBy
          : "";
    const knownName = actorId
      ? options.knownActorNames?.get(actorId)?.trim()
      : undefined;

    const actorName =
      (typeof serialized.actorName === "string" && serialized.actorName.trim()) ||
      knownName ||
      (await resolveAuditActorDisplayName(
        {
          actorName:
            typeof serialized.actorName === "string" ? serialized.actorName : undefined,
          actorId:
            typeof serialized.actorId === "string" ? serialized.actorId : undefined,
          performedBy:
            typeof serialized.performedBy === "string"
              ? serialized.performedBy
              : undefined,
        },
        { sessionUserFullName: options.sessionUserFullName },
      ));

    items.push({
      id: doc.id,
      action: String(serialized.action ?? action),
      label: ACTIVITY_LABELS[action] ?? action,
      entityId: String(serialized.entityId ?? ""),
      actorId: String(serialized.actorId ?? serialized.performedBy ?? ""),
      actorName,
      role: String(serialized.role ?? serialized.performedByRole ?? ""),
      performedBy: String(serialized.performedBy ?? ""),
      createdAt: String(serialized.createdAt ?? ""),
      metadata:
        serialized.metadata && typeof serialized.metadata === "object"
          ? (serialized.metadata as Record<string, unknown>)
          : undefined,
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}
