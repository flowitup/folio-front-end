"use server";

/**
 * Notification server actions
 * Client components call these instead of importing lib/api/notifications directly.
 * fetchNotificationsFeedAction swallows errors (bell silently shows last-known state).
 * dismissNotificationAction maps backend errors for optimistic-rollback handling.
 */

import { listDueNotifications, dismissNotification } from "@/lib/api/notifications";
import { getSession } from "@/lib/auth/session";
import type { NotificationsFeed } from "@/lib/api/notifications";

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
 * Fetch the whole bell feed (note reminders + attendance awaiting validation).
 * Returns an empty feed on any error — the bell keeps its last-known state.
 */
export async function fetchNotificationsFeedAction(): Promise<NotificationsFeed> {
  try {
    const result = await listDueNotifications();
    return { items: result.items, attendance: result.attendance_pending ?? [] };
  } catch {
    return { items: [], attendance: [] };
  }
}

/**
 * Dismiss a notification by note ID.
 * Returns { success: true } on 204, or { success: false, error: string } on failure.
 */
export async function dismissNotificationAction(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { success: false, error: "unauthorized" };
  }
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
