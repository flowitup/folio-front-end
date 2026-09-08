"use server";

/**
 * Settings → Notifications server actions.
 *
 * Thin wrappers over the server-only API client: the client component cannot
 * import `@/lib/api/notifications` (it reads next/headers), so it goes through here.
 */

import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/api/notifications";
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from "@/types/notification-preferences";

export type NotificationPreferencesResult =
  | { ok: true; data: NotificationPreferences }
  | { ok: false; error: "unauthorized" | "unknown" };

function classify(err: unknown): "unauthorized" | "unknown" {
  const status = (err as { status?: number } | null)?.status;
  return status === 401 ? "unauthorized" : "unknown";
}

export async function fetchNotificationPreferencesAction(): Promise<NotificationPreferencesResult> {
  try {
    return { ok: true, data: await getNotificationPreferences() };
  } catch (err) {
    return { ok: false, error: classify(err) };
  }
}

export async function updateNotificationPreferencesAction(
  changes: NotificationPreferencesUpdate
): Promise<NotificationPreferencesResult> {
  try {
    return { ok: true, data: await updateNotificationPreferences(changes) };
  } catch (err) {
    return { ok: false, error: classify(err) };
  }
}
