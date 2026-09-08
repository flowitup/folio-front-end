/**
 * Company member-onboarding API wrappers — server-only.
 *
 * Three endpoints (Phase 2 onboarding slice):
 *   POST /companies/<id>/members          — add a member by phone (admin)
 *   POST /companies/<id>/members/import   — import profiles from another
 *                                            company the caller also admins
 *   GET  /companies/<id>/persons          — company member directory
 *                                            (admin or manager)
 *
 * Distinct from `companies/attached-users.ts` (users already attached, with
 * their company role) — this file is about the `persons`/`company_persons`
 * onboarding surface (phone-matched identity, pending profiles, linked-user
 * badge).
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

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

// ---------------------------------------------------------------------------
// Add member by phone
// ---------------------------------------------------------------------------

export interface AddMemberByPhoneResult {
  person_id: string;
  name: string;
  phone: string;
}

/**
 * 409 shape when several un-linked profiles match the phone number — resend
 * with `person_id` set to one of `candidates` to disambiguate.
 */
export interface AddMemberCandidatesError {
  candidates: { person_id: string; name: string }[];
}

export async function addMemberByPhone(
  companyId: string,
  payload: { phone: string; name?: string; role?: "manager" | "member"; person_id?: string }
): Promise<AddMemberByPhoneResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error adding member by phone: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to add member by phone");
  return response.json() as Promise<AddMemberByPhoneResult>;
}

// ---------------------------------------------------------------------------
// Import members from another company
// ---------------------------------------------------------------------------

export interface ImportedMember {
  person_id: string;
  name: string;
  phone: string;
  linked_user_id: string | null;
}

export interface ImportMembersResult {
  items: ImportedMember[];
  skipped_person_ids: string[];
}

export async function importMembers(
  companyId: string,
  payload: { from_company_id: string; person_ids: string[] }
): Promise<ImportMembersResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/members/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error importing members: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to import members");
  return response.json() as Promise<ImportMembersResult>;
}

// ---------------------------------------------------------------------------
// Company directory
// ---------------------------------------------------------------------------

export interface CompanyDirectoryEntry {
  person_id: string;
  name: string;
  phone: string;
  linked_user_id: string | null;
  assigned_project_ids: string[];
  is_active: boolean;
  pending: boolean;
  labor_role_id: string | null;
  default_daily_rate: number | null;
}

export async function fetchCompanyDirectory(companyId: string): Promise<CompanyDirectoryEntry[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/companies/${encodeURIComponent(companyId)}/persons`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing company directory: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list company directory");
  const data = (await response.json()) as { items?: CompanyDirectoryEntry[] };
  return data.items ?? [];
}
