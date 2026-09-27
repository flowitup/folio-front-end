"use server";

// Labor-role actions (list / create / rename / delete) are company-level and
// shared with Settings, so they live in @/components/labor/labor-role-actions.

import { redirect } from "next/navigation";
import { fetchDayRoster } from "@/lib/api/roster";
import type { RosterResponse } from "@/lib/api/roster";

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
