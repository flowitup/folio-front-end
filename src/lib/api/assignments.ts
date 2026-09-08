/**
 * Project assignment API wrappers — server-only.
 *
 * Assignment targets an EXISTING company member and never creates an account
 * (distinct from the outsider e-mail invitation flow in `invitations.ts`).
 * PUT /projects/<id>/assignments/<user_id> — admin may assign any role
 * (manager|member); manager may only assign member.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export type ProjectAssignmentRole = "manager" | "member";

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

/**
 * Assign (or change the role of) an existing company member on a project.
 * PUT /projects/<projectId>/assignments/<userId>
 */
export async function assignProjectMember(
  projectId: string,
  userId: string,
  role: ProjectAssignmentRole
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ role }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error assigning project member: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to assign project member");
}

/**
 * Remove a manager/member assignment from a project.
 * DELETE /projects/<projectId>/assignments/<userId>
 */
export async function unassignProjectMember(projectId: string, userId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/projects/${encodeURIComponent(projectId)}/assignments/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error unassigning project member: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to unassign project member");
}
