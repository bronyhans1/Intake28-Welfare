"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserFromSession } from "@/lib/auth/session";
import {
  archiveNotification,
  canAccessNotificationCentre,
  canManageNotifications,
  canViewNotifications,
  getRecentUnreadNotifications,
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notificationListQuerySchema,
  type NotificationListQuery,
} from "@/lib/notifications/repository";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";

export type NotificationActionState = {
  error?: string;
  success?: boolean;
  count?: number;
};

const SERVER_UNAVAILABLE =
  "Notifications are temporarily unavailable. Please try again later.";

function revalidateNotificationPaths() {
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/dashboard");
  revalidatePath("/portal/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<NotificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canAccessNotificationCentre(actor.role)) {
    return { error: "You do not have permission to manage notifications." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    await markNotificationAsRead(notificationId, actor);
    revalidateNotificationPaths();
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark notification as read.",
    };
  }
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canAccessNotificationCentre(actor.role)) {
    return { error: "You do not have permission to manage notifications." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    const count = await markAllNotificationsAsRead(actor);
    revalidateNotificationPaths();
    return { success: true, count };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to mark notifications as read.",
    };
  }
}

export async function archiveNotificationAction(
  notificationId: string,
): Promise<NotificationActionState> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canManageNotifications(actor.role)) {
    return { error: "You do not have permission to archive notifications." };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  try {
    await archiveNotification(notificationId, actor);
    revalidateNotificationPaths();
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to archive notification.",
    };
  }
}

export async function fetchUnreadNotificationCountAction(): Promise<{
  count: number;
  error?: string;
}> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canAccessNotificationCentre(actor.role)) {
    return { count: 0, error: "Unauthorized" };
  }

  if (!isFirebaseAdminConfigured()) {
    return { count: 0 };
  }

  const count = await getUnreadNotificationCount(actor);
  return { count };
}

export async function fetchRecentUnreadNotificationsAction(limit = 5): Promise<{
  records: Awaited<ReturnType<typeof getRecentUnreadNotifications>>;
  error?: string;
}> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canAccessNotificationCentre(actor.role)) {
    return { records: [], error: "Unauthorized" };
  }

  if (!isFirebaseAdminConfigured()) {
    return { records: [] };
  }

  const records = await getRecentUnreadNotifications(actor, limit);
  return { records };
}

export async function fetchNotificationsAction(
  query: NotificationListQuery,
): Promise<
  | { success: true; data: Awaited<ReturnType<typeof listNotificationsForUser>> }
  | { error: string }
> {
  const actor = await getCurrentUserFromSession();

  if (!actor || !canAccessNotificationCentre(actor.role)) {
    return { error: "Unauthorized" };
  }

  if (!isFirebaseAdminConfigured()) {
    return { error: SERVER_UNAVAILABLE };
  }

  const parsed = notificationListQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { error: "Invalid query parameters." };
  }

  try {
    return {
      success: true,
      data: await listNotificationsForUser(actor, parsed.data),
    };
  } catch {
    return { error: "Failed to load notifications." };
  }
}

export { canViewNotifications };
