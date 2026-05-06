/**
 * Company invite-token API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 *
 * IMPORTANT: generateInviteToken returns a plaintext token exposed ONLY at
 * generation time. Surface it once via a dialog; do NOT log or persist it.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { CompanyInviteTokenGenerated, MyCompany } from "@/types/companies";

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
 * Generate (or regenerate) an invite token for a company.
 * POST /api/v1/companies/<companyId>/invite-tokens
 *
 * If an active token already exists and regenerate is false (default), the BE
 * returns 409 `active_token_exists`. Pass regenerate=true to atomically
 * replace the existing token.
 *
 * The returned `token` string is the plaintext — pass it directly to the
 * caller for display. Do NOT log it.
 */
export async function generateInviteToken(
  companyId: string,
  opts?: { regenerate?: boolean }
): Promise<CompanyInviteTokenGenerated> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams();
  if (opts?.regenerate) params.set("regenerate", "true");
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/invite-tokens${query ? `?${query}` : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error generating invite token: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to generate invite token");
  return response.json() as Promise<CompanyInviteTokenGenerated>;
}

/**
 * Revoke the active invite token for a company.
 * DELETE /api/v1/companies/<companyId>/invite-tokens/active
 */
export async function revokeInviteToken(companyId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/invite-tokens/active`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error revoking invite token: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to revoke invite token");
}

/**
 * Redeem an invite token to attach the current user to a company.
 * POST /api/v1/companies/attach-by-token
 *
 * Returns the newly-attached company (with is_primary + attached_at).
 * BE uses uniform 410 for expired/already-redeemed/invalid tokens to avoid
 * leaking token existence. Rate limited at 5/min.
 */
export async function redeemInviteToken(token: string): Promise<MyCompany> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/attach-by-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error redeeming invite token: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to redeem invite token");
  return response.json() as Promise<MyCompany>;
}
