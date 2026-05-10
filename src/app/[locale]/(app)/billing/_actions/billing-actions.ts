"use server";

/**
 * Billing server actions.
 *
 * Each action wraps a server-only API client call and returns a discriminated
 * union: { ok: true, data } | { ok: false, error: { code, message } }.
 *
 * Special-case error codes:
 * - "company_profile_missing"      (HTTP 409) — redirect to /settings#company-profile
 * - "company_no_longer_attached"   (HTTP 409) — user's company access revoked mid-flow;
 *                                               phase 08 resets the company picker on this code.
 *
 * Cookie forwarding: billing mutations use JWT bearer auth (sessionAuthHeader),
 * so no Set-Cookie forwarding is needed — tokens are read from the existing
 * session cookie. The setForwardedCookies pattern applies only when the backend
 * issues new cookies (login/refresh flows).
 */

import {
  fetchBillingDocuments,
  fetchBillingDocument,
  createBillingDocument,
  updateBillingDocument,
  deleteBillingDocument,
  cloneBillingDocument,
  convertDevisToFacture,
  updateBillingDocumentStatus,
  createBillingDocumentFromTemplate,
  fetchActivitySuggestions,
  type ActivitySuggestionsResponse,
  type FetchActivitySuggestionsParams,
} from "@/lib/api/billing/documents";
import { fetchBillingTemplates, fetchBillingTemplate } from "@/lib/api/billing/templates";
import {
  createBillingTemplate,
  updateBillingTemplate,
  deleteBillingTemplate,
} from "@/lib/api/billing/templates";
import type {
  BillingDocument,
  BillingDocumentKind,
  BillingDocumentTemplate,
  BillingDocumentStatus,
  CreateBillingDocumentPayload,
  UpdateBillingDocumentPayload,
  CloneBillingDocumentPayload,
  ConvertDevisToFacturePayload,
  ApplyTemplatePayload,
  CreateBillingTemplatePayload,
  UpdateBillingTemplatePayload,
} from "@/types/billing";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Internal error classifier
// ---------------------------------------------------------------------------

function classifyBackendError(err: unknown): { code: string; message: string } {
  const e = err as {
    status?: number;
    body?: Record<string, unknown> | null;
    message?: string;
  };
  const status = e.status;
  const body = e.body ?? {};
  const reason = typeof body["reason"] === "string" ? body["reason"] : "";
  const bodyMsg = typeof body["message"] === "string" ? body["message"] : "";

  // 409 with reason: "company_profile_missing" — caller should redirect to /settings#company-profile
  if (status === 409 && reason === "company_profile_missing") {
    return { code: "company_profile_missing", message: "Company profile is required before creating billing documents." };
  }
  // 409 with reason: "company_no_longer_attached" — user's access was revoked between picker render
  // and form submit. Phase 08 will surface a toast + reset the company picker on this code.
  if (status === 409 && reason === "company_no_longer_attached") {
    return { code: "company_no_longer_attached", message: "Your access to this company has been revoked. Please select another company." };
  }
  if (status === 409) return { code: "conflict", message: bodyMsg || "A conflict occurred." };
  if (status === 400 || status === 422) return { code: "validation", message: bodyMsg || "Validation error." };
  if (status === 401) return { code: "unauthorized", message: "Session expired. Please log in again." };
  if (status === 403) return { code: "forbidden", message: "You do not have permission to perform this action." };
  if (status === 404) return { code: "not_found", message: "The requested resource was not found." };
  if (status === 429) return { code: "rate_limited", message: "Too many requests. Please wait and try again." };

  const fallbackMsg = e.message ?? "An unexpected error occurred.";
  return { code: "generic", message: fallbackMsg };
}

// ---------------------------------------------------------------------------
// Billing document actions
// ---------------------------------------------------------------------------

export async function createBillingDocumentAction(
  payload: CreateBillingDocumentPayload
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await createBillingDocument(payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function updateBillingDocumentAction(
  id: string,
  payload: UpdateBillingDocumentPayload
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await updateBillingDocument(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function deleteBillingDocumentAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    await deleteBillingDocument(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function cloneBillingDocumentAction(
  id: string,
  payload?: CloneBillingDocumentPayload
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await cloneBillingDocument(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function convertDevisToFactureAction(
  id: string,
  payload?: ConvertDevisToFacturePayload
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await convertDevisToFacture(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function updateBillingDocumentStatusAction(
  id: string,
  new_status: BillingDocumentStatus
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await updateBillingDocumentStatus(id, new_status);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function createBillingDocumentFromTemplateAction(
  template_id: string,
  payload: ApplyTemplatePayload
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await createBillingDocumentFromTemplate(template_id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function listBillingDocumentsAction(
  kind: BillingDocumentKind,
  limit = 25
): Promise<ActionResult<{ items: BillingDocument[]; total: number }>> {
  try {
    const data = await fetchBillingDocuments({ kind, limit, offset: 0 });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function getBillingDocumentAction(
  id: string
): Promise<ActionResult<BillingDocument>> {
  try {
    const data = await fetchBillingDocument(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function listBillingTemplatesAction(
  kind?: BillingDocumentKind
): Promise<ActionResult<BillingDocumentTemplate[]>> {
  try {
    const data = await fetchBillingTemplates(kind);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function getBillingTemplateAction(
  id: string
): Promise<ActionResult<BillingDocumentTemplate>> {
  try {
    const data = await fetchBillingTemplate(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

// ---------------------------------------------------------------------------
// Billing template actions
// ---------------------------------------------------------------------------

export async function createBillingTemplateAction(
  payload: CreateBillingTemplatePayload
): Promise<ActionResult<BillingDocumentTemplate>> {
  try {
    const data = await createBillingTemplate(payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function updateBillingTemplateAction(
  id: string,
  payload: UpdateBillingTemplatePayload
): Promise<ActionResult<BillingDocumentTemplate>> {
  try {
    const data = await updateBillingTemplate(id, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

export async function deleteBillingTemplateAction(
  id: string
): Promise<ActionResult<void>> {
  try {
    await deleteBillingTemplate(id);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

// ---------------------------------------------------------------------------
// Activity suggestions action (Phase 05)
// ---------------------------------------------------------------------------

export async function getActivitySuggestionsAction(
  params: FetchActivitySuggestionsParams
): Promise<ActionResult<ActivitySuggestionsResponse>> {
  try {
    const data = await fetchActivitySuggestions(params);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

