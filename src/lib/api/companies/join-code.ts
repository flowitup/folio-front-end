/**
 * Company join-code API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 *
 * A join code is a reusable 8-character code (superadmin-managed) that any signed-in
 * user can type to join the company as a member; it stays valid until revoked or
 * renewed. It complements the single-use invite tokens in invite-tokens.ts.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { Company } from "@/types/companies";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

function baseUrl(): string {
  return env.apiBaseUrl;
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * Create or renew the company's join code (replaces the previous one).
 * POST /api/v1/companies/<companyId>/join-code — superadmin only.
 */
export async function setJoinCode(companyId: string): Promise<string> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/join-code`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error creating join code: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create join code");
  const data = (await response.json()) as { join_code: string };
  return data.join_code;
}

/**
 * Revoke the company's join code; members already attached keep their access.
 * DELETE /api/v1/companies/<companyId>/join-code — superadmin only.
 */
export async function revokeJoinCode(companyId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/join-code`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error revoking join code: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to revoke join code");
}

/**
 * Join a company as member with its code.
 * POST /api/v1/companies/join — 404 for an unknown/revoked code, 409 when already attached.
 */
export async function joinCompanyByCode(code: string): Promise<Company> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error joining company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to join company");
  return response.json() as Promise<Company>;
}
