/**
 * Billing document templates API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type {
  BillingDocumentTemplate,
  BillingDocumentKind,
  CreateBillingTemplatePayload,
  UpdateBillingTemplatePayload,
} from "@/types/billing";

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
 * List all billing document templates for the current user.
 * Optionally filter by kind.
 */
export async function fetchBillingTemplates(
  kind?: BillingDocumentKind
): Promise<BillingDocumentTemplate[]> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  const query = params.toString();

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-document-templates${query ? `?${query}` : ""}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing billing templates: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list billing templates");
  const data = (await response.json()) as { items: BillingDocumentTemplate[] };
  return data.items;
}

/**
 * Fetch a single billing document template by ID.
 */
export async function fetchBillingTemplate(id: string): Promise<BillingDocumentTemplate> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-document-templates/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching billing template: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch billing template");
  return response.json() as Promise<BillingDocumentTemplate>;
}

/**
 * Create a new billing document template.
 */
export async function createBillingTemplate(
  payload: CreateBillingTemplatePayload
): Promise<BillingDocumentTemplate> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-document-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating billing template: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create billing template");
  return response.json() as Promise<BillingDocumentTemplate>;
}

/**
 * Update an existing billing document template.
 */
export async function updateBillingTemplate(
  id: string,
  payload: UpdateBillingTemplatePayload
): Promise<BillingDocumentTemplate> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-document-templates/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating billing template: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to update billing template");
  return response.json() as Promise<BillingDocumentTemplate>;
}

/**
 * Delete a billing document template.
 */
export async function deleteBillingTemplate(id: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-document-templates/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error deleting billing template: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to delete billing template");
}
