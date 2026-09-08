"use server";

import { bulkAddMemberships, searchUsers } from "@/lib/api/admin";
import { getSession } from "@/lib/auth/session";
import type { BulkAddResultItem, UserSearchItem } from "@/lib/api/admin";

/**
 * Server action: search users by query string.
 * Proxies the server-only admin.ts wrapper so client components don't
 * import next/headers directly.
 */
export async function searchUsersAction(
  query: string
): Promise<{ items: UserSearchItem[]; error?: string }> {
  const session = await getSession();
  if (!session?.accessToken) return { items: [], error: "unauthorized" };
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

/** Map a thrown fetch-error onto an i18n error key, inspecting the response
 *  body where the status alone is ambiguous. */
function classifyBackendError(err: unknown): string {
  const e = err as { status?: number; body?: { error?: string; message?: string } };
  const status = e.status;
  const message = (e.body?.message ?? "").toLowerCase();

  if (status === 403) return "forbidden";
  if (status === 404) return "userNotFound";
  if (status === 400) return "tooMany"; // EmptyProjectListError / TooManyProjectsError; FE pre-validates so rare
  if (status === 422) {
    // Pydantic ValidationError — usually wrong-types or out-of-bounds project_ids
    if (message.includes("project_ids")) return "tooMany";
    return "generic";
  }
  if (status === 429) return "rateLimited";
  return "generic";
}

/**
 * Server action: bulk-add a user to multiple projects.
 * Validates inputs server-side before hitting the backend.
 * Maps known HTTP status codes (with response-body inspection) to i18n error keys.
 */
export async function bulkAddMembershipsAction(
  userId: string,
  projectIds: string[]
): Promise<{ success: boolean; results?: BulkAddResultItem[]; error?: string }> {
  const session = await getSession();
  if (!session?.accessToken) {
    return { success: false, error: "unauthorized" };
  }
  // --- Server-side input validation ---
  if (!userId || !isUuid(userId)) {
    return { success: false, error: "userNotFound" };
  }
  if (!Array.isArray(projectIds) || projectIds.length < 1) {
    // M3 — match the existing i18n key admin.bulkAdd.errors.projectsRequired.
    return { success: false, error: "projectsRequired" };
  }
  if (projectIds.length > 50) {
    return { success: false, error: "tooMany" };
  }
  if (!projectIds.every(isUuid)) {
    return { success: false, error: "generic" };
  }

  try {
    const result = await bulkAddMemberships(userId, { project_ids: projectIds });
    return { success: true, results: result.results };
  } catch (err: unknown) {
    return { success: false, error: classifyBackendError(err) };
  }
}
