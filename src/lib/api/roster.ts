/**
 * Day roster API wrapper — server-only.
 *
 * GET /projects/<id>/labor/roster?date= — the member-safe view of a project's
 * day: name, presence, hours, day type. NEVER rate/cost/amount/total (D3).
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export interface RosterRow {
  worker_id: string;
  name: string;
  status: "present" | "pending" | "absent";
  hours: number;
  day_type: string | null;
}

export interface RosterResponse {
  rows: RosterRow[];
}

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

/** Fetch the day roster for a project. `date` must be YYYY-MM-DD. */
export async function fetchDayRoster(projectId: string, date: string): Promise<RosterResponse> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/labor/roster?date=${encodeURIComponent(date)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching day roster: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch day roster");
  return response.json() as Promise<RosterResponse>;
}
