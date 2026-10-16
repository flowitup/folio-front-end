/**
 * Company attached-users API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { AttachedUser, CompanyRole } from "@/types/companies";

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

/** Largest page the API serves (`?limit` max). */
const ATTACHED_USERS_PAGE = 200;
/** Safety stop: never loop forever on a misbehaving `total`. */
const ATTACHED_USERS_MAX_PAGES = 50;

/**
 * List ALL users attached to a company, page after page.
 * GET /api/v1/companies/<companyId>/attached-users?limit=&offset=
 * Requires admin role (*:*).
 *
 * The API pages (default 50); reading only the first page left every member past
 * the 50th unlisted and unmanageable, so this follows `total` to the end.
 */
export async function fetchAttachedUsers(companyId: string): Promise<AttachedUser[]> {
  const authHeaders = await sessionAuthHeader();
  const all: AttachedUser[] = [];
  for (let page = 0; page < ATTACHED_USERS_MAX_PAGES; page++) {
    const offset = page * ATTACHED_USERS_PAGE;
    let response: Response;
    try {
      response = await fetch(
        `${baseUrl()}/companies/${encodeURIComponent(companyId)}/attached-users?limit=${ATTACHED_USERS_PAGE}&offset=${offset}`,
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
    const data = (await response.json()) as { items?: AttachedUser[]; total?: number };
    const items = data.items ?? [];
    all.push(...items);
    const total = typeof data.total === "number" ? data.total : all.length;
    if (items.length === 0 || all.length >= total) break;
  }
  return all;
}

/**
 * Attach an existing user account to a company as "member". Idempotent —
 * calling it again for someone already attached succeeds without changes.
 * POST /api/v1/companies/<companyId>/access/<userId>
 * Requires admin role on the path company (*:*).
 */
export async function attachUserToCompany(companyId: string, userId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/access/${encodeURIComponent(userId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error attaching user to company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to attach user to company");
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

/**
 * Change a company member's role (promote/demote between admin and member).
 * PATCH /api/v1/companies/<companyId>/access/<userId>/role
 * Requires admin role (*:*).
 */
export async function setMemberRole(
  companyId: string,
  userId: string,
  role: CompanyRole
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/access/${encodeURIComponent(userId)}/role`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ role }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error setting member role: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to set member role");
}
