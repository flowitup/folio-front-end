/**
 * Company attached-users API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { AttachedUser } from "@/types/companies";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: Record<string, unknown> | null }> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: Record<string, unknown> | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

function baseUrl(): string {
  return env.apiBaseUrl;
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * List all users attached to a company.
 * GET /api/v1/companies/<companyId>/attached-users
 * Requires admin role (*:*).
 */
export async function fetchAttachedUsers(companyId: string): Promise<AttachedUser[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/attached-users`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing attached users: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list attached users");
  const data = (await response.json()) as { items: AttachedUser[] };
  return data.items;
}

/**
 * Remove (boot) a specific user from a company.
 * DELETE /api/v1/companies/<companyId>/access/<userId>
 * Requires admin role (*:*).
 */
export async function bootAttachedUser(companyId: string, userId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/access/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error booting attached user: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to boot attached user");
}
