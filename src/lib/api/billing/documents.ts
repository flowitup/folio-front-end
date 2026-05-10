/**
 * Billing documents API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 * Client components must go through billing-actions.ts server actions.
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import type {
  BillingDocument,
  BillingDocumentKind,
  BillingDocumentStatus,
  CreateBillingDocumentPayload,
  UpdateBillingDocumentPayload,
  CloneBillingDocumentPayload,
  ConvertDevisToFacturePayload,
  ApplyTemplatePayload,
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
// List filters
// ---------------------------------------------------------------------------

export interface BillingDocumentFilter {
  kind: BillingDocumentKind;
  status?: BillingDocumentStatus;
  project_id?: string;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * List billing documents with optional filters.
 * Returns paginated result: { items, total }.
 */
export async function fetchBillingDocuments(
  filter: BillingDocumentFilter
): Promise<{ items: BillingDocument[]; total: number }> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams({ kind: filter.kind });
  if (filter.status) params.set("status", filter.status);
  if (filter.project_id) params.set("project_id", filter.project_id);
  if (filter.limit !== undefined) params.set("limit", String(filter.limit));
  if (filter.offset !== undefined) params.set("offset", String(filter.offset));

  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error listing billing documents: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list billing documents");
  return response.json() as Promise<{ items: BillingDocument[]; total: number }>;
}

/**
 * Fetch a single billing document by ID.
 */
export async function fetchBillingDocument(id: string): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching billing document: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch billing document");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Create a new billing document.
 */
export async function createBillingDocument(
  payload: CreateBillingDocumentPayload
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating billing document: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create billing document");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Update an existing billing document (full replacement of mutable fields).
 */
export async function updateBillingDocument(
  id: string,
  payload: UpdateBillingDocumentPayload
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error updating billing document: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to update billing document");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Delete a billing document.
 */
export async function deleteBillingDocument(id: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error deleting billing document: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to delete billing document");
}

/**
 * Clone a billing document with optional kind override.
 */
export async function cloneBillingDocument(
  id: string,
  payload?: CloneBillingDocumentPayload
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}/billing-documents/${encodeURIComponent(id)}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload ?? {}),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error cloning billing document: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to clone billing document");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Convert a devis to a facture.
 */
export async function convertDevisToFacture(
  id: string,
  payload?: ConvertDevisToFacturePayload
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/${encodeURIComponent(id)}/convert-to-facture`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload ?? {}),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error converting devis to facture: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to convert devis to facture");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Update the status of a billing document.
 */
export async function updateBillingDocumentStatus(
  id: string,
  new_status: BillingDocumentStatus
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ new_status }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating billing document status: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to update billing document status");
  return response.json() as Promise<BillingDocument>;
}

/**
 * Fetch the PDF for a billing document.
 * Parses Content-Disposition (RFC-5987 aware) for the filename.
 */
export async function fetchBillingDocumentPdf(
  id: string
): Promise<{ blob: Blob; filename: string }> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/${encodeURIComponent(id)}/pdf`,
      {
        method: "GET",
        headers: { ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching billing document PDF: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch billing document PDF");

  const cd = response.headers.get("Content-Disposition");
  const filename = parseFilenameFromContentDisposition(cd, `billing-document-${id}.pdf`);
  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Fetch the XLSX (Open Office XML) for a billing document.
 * Mirrors fetchBillingDocumentPdf — same auth, same content-disposition parsing.
 */
export async function fetchBillingDocumentXlsx(
  id: string
): Promise<{ blob: Blob; filename: string }> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/${encodeURIComponent(id)}/xlsx`,
      {
        method: "GET",
        headers: { ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching billing document XLSX: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch billing document XLSX");

  const cd = response.headers.get("Content-Disposition");
  const filename = parseFilenameFromContentDisposition(cd, `billing-document-${id}.xlsx`);
  const blob = await response.blob();
  return { blob, filename };
}

// ---------------------------------------------------------------------------
// Activity suggestions (Phase 05)
// ---------------------------------------------------------------------------

/** One distinct category with its historical frequency. */
export interface ActivityCategory {
  name: string;
  frequency: number;
}

/** One past line-item suggestion returned by the suggestions endpoint. */
export interface ActivitySuggestion {
  description: string;
  category: string | null;
  frequency: number;
  last_unit: string | null;
  last_unit_price: string;
  last_vat_rate: string;
}

export interface ActivitySuggestionsResponse {
  categories: ActivityCategory[];
  suggestions: ActivitySuggestion[];
}

export interface FetchActivitySuggestionsParams {
  category?: string | null;
  q?: string;
  limit?: number;
}

/**
 * Fetch activity suggestions (categories + past line-item descriptions).
 * Server-only — uses sessionAuthHeader.
 */
export async function fetchActivitySuggestions(
  params: FetchActivitySuggestionsParams
): Promise<ActivitySuggestionsResponse> {
  const authHeaders = await sessionAuthHeader();
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.q !== undefined && params.q !== "") qs.set("q", params.q);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/activity-suggestions?${qs.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        // Intentionally no cache override — relies on Next.js fetch defaults
        // (no-store set in calling action). Suggestions are always fresh.
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching activity suggestions: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to fetch activity suggestions");
  return response.json() as Promise<ActivitySuggestionsResponse>;
}

/**
 * Create a billing document from an existing template.
 */
export async function createBillingDocumentFromTemplate(
  template_id: string,
  payload: ApplyTemplatePayload
): Promise<BillingDocument> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/billing-documents/from-template/${encodeURIComponent(template_id)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error creating document from template: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create document from template");
  return response.json() as Promise<BillingDocument>;
}
