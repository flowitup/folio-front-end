/**
 * Labor Roles API client functions — server-only.
 *
 * These are NOT project-scoped: the endpoint is /api/v1/labor/roles.
 * Client components must NOT import this directly; go through server
 * actions (labor/actions.ts) instead.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type {
  LaborRole,
  LaborRoleListResponse,
  CreateLaborRolePayload,
} from "@/types/labor-role";

// ---- Error helper ----

async function buildHttpError(
  response: Response,
  prefix: string,
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

// ---- Wrappers ----

/**
 * Fetch all labor roles and the default palette.
 */
export async function fetchLaborRoles(): Promise<LaborRoleListResponse> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/labor/roles`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching labor roles: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to fetch labor roles");
  }
  return response.json() as Promise<LaborRoleListResponse>;
}

/**
 * Create a new labor role.
 */
export async function createLaborRole(
  payload: CreateLaborRolePayload,
): Promise<LaborRole> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/labor/roles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating labor role: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to create labor role");
  }
  return response.json() as Promise<LaborRole>;
}

