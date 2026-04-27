/**
 * Members API wrapper
 * Fetches project members from the backend.
 * Used in server components for the members page.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export interface ProjectMember {
  user_id: string;
  email: string;
  display_name: string | null;
  role_name: string;
  joined_at: string;
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
  return response.json();
}
