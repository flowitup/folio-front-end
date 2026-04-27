/**
 * Admin API wrappers
 * Typed wrappers for superadmin-only endpoints:
 *   - User search (GET /admin/users)
 *   - Bulk-add memberships (POST /admin/users/:id/memberships)
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---- Types ----

export interface UserSearchItem {
  id: string;
  email: string;
  display_name: string | null;
}

export interface BulkAddResultItem {
  project_id: string;
  project_name: string | null;
  status:
    | "added"
    | "already_member_same_role"
    | "already_member_different_role"
    | "project_not_found";
}

// ---- Wrappers ----

/**
 * Search users by email/name fragment.
 * Requires superadmin session.
 * Throws with `.status` attached on non-2xx.
 */
export async function searchUsers(
  query: string,
  limit = 20
): Promise<UserSearchItem[]> {
  const authHeaders = await sessionAuthHeader();
  const url = new URL(`${env.apiBaseUrl}/admin/users`);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error searching users: ${String(err)}`);
  }

  if (!response.ok) {
    throw await buildHttpError(response, "Failed to search users");
  }

  const data: { items: UserSearchItem[]; count: number } = await response.json();
  return data.items;
}

/**
 * Bulk-add a user to multiple projects under one role.
 * Requires superadmin session.
 * Throws with `.status` attached on non-2xx.
 */
export async function bulkAddMemberships(
  userId: string,
  payload: { project_ids: string[]; role_id: string }
): Promise<{ results: BulkAddResultItem[] }> {
  const authHeaders = await sessionAuthHeader();

  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/admin/users/${encodeURIComponent(userId)}/memberships`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error adding memberships: ${String(err)}`);
  }

  if (!response.ok) {
    throw await buildHttpError(response, "Failed to add memberships");
  }

  return response.json();
}

/**
 * Parse a non-2xx response and produce an Error carrying both `.status`
 * and `.body` (the parsed JSON, if any). The server-action layer uses
 * the body fields (`error`, `message`) to discriminate same-status causes
 * — e.g. 403 forbidden vs roleNotAllowed, 404 user vs role.
 */
async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // Non-JSON body (or empty) — leave body as null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}
