"use server";

/**
 * Notification server actions
 * Client components call these instead of importing lib/api/notifications directly.
 * fetchDueNotificationsAction swallows errors (bell silently shows last-known state).
 * dismissNotificationAction maps backend errors for optimistic-rollback handling.
 */

import { listDueNotifications, dismissNotification } from "@/lib/api/notifications";
import type { DueNotification } from "@/lib/api/notifications";

// ---- UUID validation ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// ---- Error classification ----

function classifyBackendError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const status = e.status;

  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 429) return "rateLimited";
  return "generic";
}

// ---- Actions ----

/**
 * Fetch all due notifications for the current user.
 * Returns empty array on any error — bell shows last-known state without disrupting UI.
 */
export async function fetchDueNotificationsAction(): Promise<DueNotification[]> {
  try {
    const result = await listDueNotifications();
    return result.items;
  } catch {
    return [];
  }
}

/**
 * Dismiss a notification by note ID.
 * Returns { success: true } on 204, or { success: false, error: string } on failure.
 */
export async function dismissNotificationAction(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  if (!noteId || !isUuid(noteId)) {
    return { success: false, error: "validation" };
  }

  try {
    await dismissNotification(noteId);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}
