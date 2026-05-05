/**
 * Company profile API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { CompanyProfile, UpsertCompanyProfilePayload } from "@/types/billing";

// ---------------------------------------------------------------------------
// Internal helper
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
 * Fetch the current user's company profile.
 * Returns null when no profile exists yet (404).
 */
export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/company-profile`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching company profile: ${String(err)}`);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch company profile");
  return response.json() as Promise<CompanyProfile>;
}

/**
 * Create or update (upsert) the current user's company profile.
 */
export async function upsertCompanyProfile(
  payload: UpsertCompanyProfilePayload
): Promise<CompanyProfile> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/company-profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error upserting company profile: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to upsert company profile");
  return response.json() as Promise<CompanyProfile>;
}
