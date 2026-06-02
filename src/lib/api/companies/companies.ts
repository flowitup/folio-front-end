/**
 * Companies API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 * Client components must go through companies-actions.ts server actions.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { Company, MyCompany } from "@/types/companies";

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
// Payload types
// ---------------------------------------------------------------------------

export interface CreateCompanyPayload {
  legal_name: string;
  address: string;
  siret?: string | null;
  tva_number?: string | null;
  iban?: string | null;
  bic?: string | null;
  logo_url?: string | null;
  default_payment_terms?: string | null;
  prefix_override?: string | null;
}

export type UpdateCompanyPayload = Partial<CreateCompanyPayload>;

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * List companies attached to the current user.
 * Equivalent to GET /api/v1/companies (default scope = my companies).
 */
export async function fetchMyCompanies(): Promise<MyCompany[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing my companies: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list my companies");
  const data = (await response.json()) as { items: unknown[] };
  return data.items.map(normalizeMyCompany);
}

/**
 * GET /companies returns each attachment as a nested `{ access, company }`
 * pair, but the rest of the app consumes a flat `MyCompany` (Company fields +
 * is_primary + attached_at). Flatten here so callers can read `.id` /
 * `.is_primary` directly. Tolerant of an already-flat item (passthrough).
 */
function normalizeMyCompany(item: unknown): MyCompany {
  if (
    item &&
    typeof item === "object" &&
    "company" in item &&
    "access" in item
  ) {
    const { company, access } = item as {
      company: Company;
      access: { is_primary: boolean; attached_at: string; role?: "admin" | "member" };
    };
    return {
      ...company,
      is_primary: access.is_primary,
      attached_at: access.attached_at,
      role: access.role ?? "member",
    };
  }
  return item as MyCompany;
}

/**
 * List all companies in the system — admin only.
 * BE will reject with 403 if the caller is not an admin.
 */
export async function fetchAllCompanies(opts?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: Company[]; total: number }> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams({ scope: "all" });
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing all companies: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list all companies");
  return response.json() as Promise<{ items: Company[]; total: number }>;
}

/**
 * Fetch a single company by ID.
 * Sensitive fields are masked or full depending on the caller's role.
 */
export async function fetchCompany(id: string): Promise<Company> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch company");
  return response.json() as Promise<Company>;
}

/**
 * Create a new company. Requires admin role (*:*).
 */
export async function createCompany(payload: CreateCompanyPayload): Promise<Company> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create company");
  return response.json() as Promise<Company>;
}

/**
 * Update an existing company. Requires admin role (*:*).
 */
export async function updateCompany(
  id: string,
  payload: UpdateCompanyPayload
): Promise<Company> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error updating company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to update company");
  return response.json() as Promise<Company>;
}

/**
 * Delete a company. Requires admin role (*:*).
 */
export async function deleteCompany(id: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error deleting company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to delete company");
}

/**
 * Set the primary company for the current user.
 * PUT /api/v1/users/me/primary-company
 */
export async function setPrimaryCompany(companyId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/users/me/primary-company`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ company_id: companyId }),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error setting primary company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to set primary company");
}

/**
 * Detach (leave) a company as the current user.
 * DELETE /api/v1/companies/<id>/access
 */
export async function detachCompany(id: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/companies/${encodeURIComponent(id)}/access`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error detaching company: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to detach company");
}
