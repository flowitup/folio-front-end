"use server";

import { bulkAddMemberships, searchUsers } from "@/lib/api/admin";
import type { BulkAddResultItem, UserSearchItem } from "@/lib/api/admin";

/**
 * Server action: search users by query string.
 * Proxies the server-only admin.ts wrapper so client components don't
 * import next/headers directly.
 */
export async function searchUsersAction(
  query: string
): Promise<{ items: UserSearchItem[]; error?: string }> {
  if (!query || query.length < 3) return { items: [] };
  if (query.length > 100) return { items: [], error: "queryTooLong" };
  try {
    const items = await searchUsers(query);
    return { items };
  } catch {
    return { items: [], error: "generic" };
  }
}

/** Simple UUID-shape check (no library — keeps deps lean). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Server action: bulk-add a user to multiple projects under one role.
 * Validates inputs server-side before hitting the backend.
 * Maps known HTTP status codes to i18n error keys (translated in client).
 */
export async function bulkAddMembershipsAction(
  userId: string,
  projectIds: string[],
  roleId: string
): Promise<{ success: boolean; results?: BulkAddResultItem[]; error?: string }> {
  // --- Server-side input validation ---
  if (!userId || !isUuid(userId)) {
    return { success: false, error: "userNotFound" };
  }
  if (!roleId || !isUuid(roleId)) {
    return { success: false, error: "roleNotFound" };
  }
  if (!Array.isArray(projectIds) || projectIds.length < 1) {
    return { success: false, error: "tooFewProjects" };
  }
  if (projectIds.length > 50) {
    return { success: false, error: "tooMany" };
  }
  if (!projectIds.every(isUuid)) {
    return { success: false, error: "generic" };
  }

  try {
    const result = await bulkAddMemberships(userId, {
      project_ids: projectIds,
      role_id: roleId,
    });
    return { success: true, results: result.results };
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 403) return { success: false, error: "forbidden" };
    if (status === 404) return { success: false, error: "userNotFound" };
    if (status === 422) return { success: false, error: "tooMany" };
    if (status === 429) return { success: false, error: "rateLimited" };
    return { success: false, error: "generic" };
  }
}
