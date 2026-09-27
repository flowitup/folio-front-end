"use server";

// Labor-role actions (list / create / rename / delete) are company-level and
// shared with Settings, so they live in @/components/labor/labor-role-actions.

import { redirect } from "next/navigation";
import { fetchDayRoster } from "@/lib/api/roster";
import type { RosterResponse } from "@/lib/api/roster";
import { listDueNotifications } from "@/lib/api/notifications";
import { changeRequestFromFeedItem } from "@/lib/labor/change-requests";
import type { AttendanceChangeRequest } from "@/types/labor";

// ---- Error classification ----

function classifyBackendError(err: unknown): string {
  const e = err as {
    status?: number;
    body?: { error?: string; message?: string } | null;
  };
  const status = e.status;

  if (status === 400 || status === 422) return "validation";
  if (status === 401) redirect("/login");
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "duplicate";
  if (status === 429) return "rateLimited";
  return "generic";
}

// ---- Day roster (member-safe: name, presence, hours, day type — never pay) ----

export type RosterActionResult =
  | { success: true; data: RosterResponse }
  | { success: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Fetch the day roster for a project. `date` must be YYYY-MM-DD. */
export async function fetchDayRosterAction(
  projectId: string,
  date: string
): Promise<RosterActionResult> {
  if (!DATE_RE.test(date)) return { success: false, error: "validation" };
  try {
    const data = await fetchDayRoster(projectId, date);
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}

// ---- Worker change requests (manager review) ----

export type ChangeRequestsActionResult =
  | { success: true; data: AttendanceChangeRequest[] }
  | { success: false; error: string };

/**
 * Open worker change requests on this project's validated days that the caller
 * may decide. The backend has no per-project listing for them: the
 * notifications feed carries every open request the caller can settle
 * (project:manage_labor), whatever the month, so it is filtered here.
 */
export async function fetchAttendanceChangeRequestsAction(
  projectId: string
): Promise<ChangeRequestsActionResult> {
  try {
    const feed = await listDueNotifications();
    const data = (feed.attendance_pending ?? [])
      .filter((item) => item.kind === "attendance_change" && item.project_id === projectId)
      .map(changeRequestFromFeedItem);
    return { success: true, data };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}
