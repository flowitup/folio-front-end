/**
 * Members API wrapper
 * Fetches + mutates project members.
 * Used in server components / server actions for the members page.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export interface ProjectMember {
  user_id: string;
  email: string;
  display_name: string | null;
  role_name: string;
  joined_at: string;
  role_id: string | null;
}

/** Error carrying `.status` (and parsed `.body`) for server-action discrimination. */
async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // non-JSON / empty body
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

/**
 * List all members of a project.
 * Requires auth + project membership.
 */
export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/members`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching members: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch members (HTTP ${response.status})`);
  }
  // BE returns { members: [...], total: N }; unwrap to array.
  const data: { members: ProjectMember[] } = await response.json();
  return data.members ?? [];
}

/**
 * Change a member's role on a project. The new role's permissions take effect
 * immediately (project-scoped checks resolve the membership role per request).
 * Throws with `.status` attached on non-2xx.
 */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  roleId: string
): Promise<{ user_id: string; role_id: string; role_name: string }> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ role_id: roleId }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating member role: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update member role");
  }
  return response.json();
}

/**
 * Remove a member from a project.
 * Throws with `.status` attached on non-2xx.
 */
export async function removeMember(projectId: string, userId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error removing member: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to remove member");
  }
}
