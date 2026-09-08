/**
 * D8 member-grants API wrappers — server-only.
 *
 * Grant/deny rows an admin sets on a manager/member, company-wide or scoped
 * to one project, drawn from the `CUSTOMISABLE_PERMISSIONS` whitelist the
 * backend returns alongside the rows (`customisable`). Resolution order
 * (backend, `app/domain/authz/resolver.py`): company-wide grant → project
 * grant → company-wide deny → project deny (deny always wins).
 *
 *   GET    /companies/<id>/members/<userId>/grants
 *   PUT    /companies/<id>/members/<userId>/grants
 *   DELETE /companies/<id>/members/<userId>/grants
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

export type GrantEffect = "grant" | "deny";

export interface MemberGrantRow {
  permission: string;
  effect: GrantEffect;
  /** null = company-wide; set = scoped to that project only. */
  project_id: string | null;
  granted_at: string;
}

export interface MemberGrantsListResult {
  grants: MemberGrantRow[];
  /** Whitelist of permissions this admin may grant/deny to this target. */
  customisable: string[];
}

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: Record<string, unknown> | null }> {
  let body: Record<string, unknown> | null = null;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: Record<string, unknown> | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

export async function listMemberGrants(
  companyId: string,
  userId: string
): Promise<MemberGrantsListResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(userId)}/grants`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing member grants: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list member grants");
  return response.json() as Promise<MemberGrantsListResult>;
}

/** Upsert a grant/deny row. Idempotent — a new effect on the same key replaces it. */
export async function setMemberGrant(
  companyId: string,
  userId: string,
  payload: { permission: string; effect: GrantEffect; project_id?: string | null }
): Promise<MemberGrantRow> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(userId)}/grants`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          permission: payload.permission,
          effect: payload.effect,
          project_id: payload.project_id ?? null,
        }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error setting member grant: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to set member grant");
  return response.json() as Promise<MemberGrantRow>;
}

/** Remove a grant/deny row. Throws 404 (via .status) if no matching row existed. */
export async function removeMemberGrant(
  companyId: string,
  userId: string,
  payload: { permission: string; project_id?: string | null }
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/members/${encodeURIComponent(userId)}/grants`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          permission: payload.permission,
          project_id: payload.project_id ?? null,
        }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error removing member grant: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to remove member grant");
}
