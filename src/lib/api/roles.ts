/**
 * Roles API wrapper
 * Fetches available roles (excluding superadmin) from the backend.
 * Used in server components to populate role selects.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export interface Role {
  id: string;
  name: string;
  description: string;
}

/**
 * List all assignable roles (superadmin excluded by backend).
 * Requires auth.
 */
export async function listRoles(): Promise<Role[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/roles`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching roles: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch roles (HTTP ${response.status})`);
  }
  return response.json();
}
