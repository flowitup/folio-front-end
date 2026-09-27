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
  UpdateLaborRolePayload,
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

/**
 * `/labor/roles`, optionally scoped to one company. Without `companyId` the
 * backend falls back to the caller's primary company; with it, the caller
 * must belong to that company (403 otherwise).
 */
function rolesUrl(companyId?: string): string {
  const base = `${env.apiBaseUrl}/labor/roles`;
  return companyId ? `${base}?company_id=${encodeURIComponent(companyId)}` : base;
}

function roleUrl(roleId: string): string {
  return `${env.apiBaseUrl}/labor/roles/${encodeURIComponent(roleId)}`;
}

// ---- Wrappers ----

/**
 * Fetch all labor roles and the default palette.
 */
export async function fetchLaborRoles(companyId?: string): Promise<LaborRoleListResponse> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(rolesUrl(companyId), {
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
  companyId?: string,
): Promise<LaborRole> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(rolesUrl(companyId), {
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


/**
 * Rename and/or recolor a labor role. The backend scopes the change to the
 * role's own company (company admin or manager, or platform ops).
 */
export async function updateLaborRole(
  roleId: string,
  payload: UpdateLaborRolePayload,
): Promise<LaborRole> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(roleUrl(roleId), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error updating labor role: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to update labor role");
  }
  return response.json() as Promise<LaborRole>;
}

/**
 * Delete a labor role. Workers holding it keep working — the database clears
 * their role (ON DELETE SET NULL), so the backend never refuses a role that is
 * still in use.
 */
export async function deleteLaborRole(roleId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(roleUrl(roleId), {
      method: "DELETE",
      headers: {
        "Cache-Control": "no-cache",
        ...authHeaders,
      },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error deleting labor role: ${String(err)}`);
  }
  if (!response.ok) {
    throw await buildHttpError(response, "Failed to delete labor role");
  }
}
