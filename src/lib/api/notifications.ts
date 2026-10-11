/**
 * Notifications API wrappers
 * Typed wrappers for user-scoped notification endpoints.
 * User-scoped (current user's due reminders) — separate from project-scoped notes.ts.
 * Server-only — imports next/headers via sessionAuthHeader.
 * Client components must NOT import this; go through server actions instead.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { Note } from "@/lib/api/notes";

// ---- Types ----

export interface DueNotification {
  /** The reminder's note, plus when it is for (YYYY-MM-DD) and how long before it fires. */
  note: Note & { due_date?: string | null; lead_time_minutes?: number | null };
  dismissed: boolean; // BE always sends this; v1 always false but must be declared
}

/**
 * An attendance item awaiting the current user's decision: a worker-submitted
 * day to validate (`attendance_pending`), or a worker's change request on an
 * already validated day (`attendance_change`, which carries the `proposed_*`
 * values and is settled through the change validate / reject routes).
 */
export interface AttendancePending {
  kind: "attendance_pending" | "attendance_change";
  /** Set on `attendance_change` only — what the worker wants the day to become. */
  proposed_shift_type?: "full" | "half" | "overtime" | null;
  proposed_supplement_hours?: number | null;
  proposed_note?: string | null;
  entry_id: string;
  project_id: string;
  project_name: string;
  worker_id: string;
  worker_name: string;
  date: string; // YYYY-MM-DD
  shift_type: "full" | "half" | "overtime" | null;
  supplement_hours: number;
  note: string | null;
  /** For a change request: when the worker asked, not when the day was first logged. */
  submitted_at: string;
}

/**
 * A member joined a company the caller admins without being assigned to any
 * project yet — surfaced to admins only (Phase 2 onboarding, `list_new_members_usecase`).
 * Deliberately excluded from the badge `count` (no client has shipped UI for
 * this feed before now — bumping the badge would be a silent behavior change
 * for every existing admin session).
 */
export interface CompanyEvent {
  user_id: string;
  display_name: string;
  company_id: string;
  attached_at: string;
}

/**
 * One entry of the activity feed: something that happened (a chat message, a task moved, an
 * invoice status change, a membership change) kept so it can be read after the push is gone.
 * `title` / `body` are already in the requested language; `data` is the push payload
 * (`kind` plus ids such as `project_id`, `task_id`, `invoice_id`).
 */
export interface ActivityEvent {
  id: string;
  category: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, string>;
  created_at: string;
  read: boolean;
}

export interface NotificationsListResult {
  items: DueNotification[];
  /** Absent on older backends — treat as empty. */
  attendance_pending?: AttendancePending[];
  /** Absent on older backends — treat as empty. Admins only. */
  company_events?: CompanyEvent[];
  /** Absent on older backends — treat as empty. Newest first. */
  events?: ActivityEvent[];
  /** Absent on older backends — treat as 0. */
  events_unread?: number;
  count: number;
}

/** What the bell renders: note reminders, attendance to validate, and company events. */
export interface NotificationsFeed {
  items: DueNotification[];
  attendance: AttendancePending[];
  /** Optional so existing feed literals (tests, older callers) stay valid — treat as empty. */
  companyEvents?: CompanyEvent[];
  /** Chat, task, billing and membership activity, newest first. Treat absent as empty. */
  events?: ActivityEvent[];
}

// ---- Error helper ----

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

// ---- Wrappers ----

/**
 * List due notifications for the current user.
 * Returns up to 100 items.
 */
export async function listDueNotifications(locale?: string): Promise<NotificationsListResult> {
  const authHeaders = await sessionAuthHeader();
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/notifications${query}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing notifications: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to list notifications");
  }
  return response.json() as Promise<NotificationsListResult>;
}

/**
 * Dismiss a notification by note ID.
 * Returns 204 No Content on success.
 */
export async function dismissNotification(noteId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/notifications/${encodeURIComponent(noteId)}/dismiss`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          ...authHeaders,
        },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error dismissing notification: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to dismiss notification");
  }
}

/**
 * Mark activity entries read: the listed ids, or every entry when `ids` is omitted.
 * Returns 204 No Content on success.
 */
export async function markActivityRead(ids?: string[]): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/notifications/events/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", ...authHeaders },
      body: JSON.stringify(ids ? { ids } : {}),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error marking activity read: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to mark activity read");
  }
}

// ---- Push notification preferences ----

import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from "@/types/notification-preferences";

export type {
  NotificationCategory,
  NotificationPreferences,
  NotificationPreferencesUpdate,
} from "@/types/notification-preferences";

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const authHeaders = await sessionAuthHeader();
  const response = await fetch(`${env.apiBaseUrl}/notifications/preferences`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-cache", ...authHeaders },
    cache: "no-store",
  });
  if (!response.ok) throw await buildHttpError(response, "Failed to load notification preferences");
  return (await response.json()) as NotificationPreferences;
}

export async function updateNotificationPreferences(
  changes: NotificationPreferencesUpdate
): Promise<NotificationPreferences> {
  const authHeaders = await sessionAuthHeader();
  const response = await fetch(`${env.apiBaseUrl}/notifications/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw await buildHttpError(response, "Failed to update notification preferences");
  return (await response.json()) as NotificationPreferences;
}
