/**
 * Members API wrapper
 * Fetches project members from the backend.
 * Used in server components for the members page.
 */

import { env } from "@/lib/config/env";
import { cookies } from "next/headers";

export interface ProjectMember {
  user_id: string;
  email: string;
  display_name: string | null;
  role_name: string;
  joined_at: string;
}

async function sessionAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token_cookie")?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
