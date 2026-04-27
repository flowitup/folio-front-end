/**
 * Roles API wrapper
 * Fetches available roles (excluding superadmin) from the backend.
 * Used in server components to populate role selects.
 */

import { env } from "@/lib/config/env";
import { cookies } from "next/headers";

export interface Role {
  id: string;
  name: string;
  description: string;
}

async function sessionAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token_cookie")?.value;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
