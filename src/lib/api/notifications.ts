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
  note: Note;
  dismissed: boolean; // BE always sends this; v1 always false but must be declared
}

export interface NotificationsListResult {
  items: DueNotification[];
  count: number;
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
export async function listDueNotifications(): Promise<NotificationsListResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/notifications`, {
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
