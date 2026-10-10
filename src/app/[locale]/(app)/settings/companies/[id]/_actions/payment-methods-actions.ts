"use server";

/**
 * Payment methods server actions.
 *
 * Each action wraps a server-only API client call and returns a discriminated
 * union: { ok: true, data } | { ok: false, error: { code, message } }.
 *
 * Special-case error codes surfaced to callers:
 * - 'builtin_delete'       — attempt to delete a built-in method (409 reason="delete")
 * - 'builtin_deactivate'   — attempt to deactivate a built-in method (409 reason="deactivate")
 * - 'duplicate_label'      — label already exists for this company (409 reason="duplicate")
 * - 'label_required'       — empty label (checked before the BE call)
 * - 'label_too_long'       — label over MAX_LABEL_LEN (checked before the BE call)
 * - 'not_found'            — payment method not found (404)
 * - 'forbidden'            — caller is not a company member (403)
 * - 'unauthorized'         — no valid JWT session (401)
 * - 'rate_limited'         — too many requests (429)
 * - 'validation'           — bad payload or identifier (400 / 422)
 * - 'generic'              — catch-all
 *
 * Every message is translated (`paymentMethods.errors.*`), so callers can toast it as is.
 *
 * No Set-Cookie forwarding needed — reads existing JWT from session cookie.
 */

import { getTranslations } from "next-intl/server";
import {
  fetchPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from "@/lib/api/payment-methods-api";
import { getSession } from "@/lib/auth/session";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Shared result type (re-exported so callers can type-narrow)
// ---------------------------------------------------------------------------

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type ActionError = { ok: false; error: { code: string; message: string } };

async function fail(code: string, key: string): Promise<ActionError> {
  const t = await getTranslations("paymentMethods.errors");
  return { ok: false, error: { code, message: t(key) } };
}

// Defense-in-depth: short-circuit before BE call when no session cookie.
async function requireSession(): Promise<{ ok: true } | ActionError> {
  const session = await getSession();
  if (!session?.accessToken) return fail("unauthorized", "unauthorized");
  return { ok: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function invalid(): Promise<ActionError> {
  return fail("validation", "validation");
}

// Same limit as the backend (label max_length=120, counted after trimming).
const MAX_LABEL_LEN = 120;

/** Error for a label the backend would refuse, or null when it is acceptable. */
function checkLabel(label: unknown): Promise<ActionError> | null {
  if (typeof label !== "string" || label.trim().length === 0) {
    return fail("label_required", "label_required");
  }
  if (label.trim().length > MAX_LABEL_LEN) return fail("label_too_long", "label_too_long");
  return null;
}

// ---------------------------------------------------------------------------
// Internal error classifier
// ---------------------------------------------------------------------------

async function classifyBackendError(err: unknown): Promise<{ code: string; message: string }> {
  const e = err as {
    status?: number;
    body?: Record<string, unknown> | null;
  };
  const status = e.status;
  const body = e.body ?? {};
  const reason = typeof body["reason"] === "string" ? body["reason"] : "";
  const t = await getTranslations("paymentMethods.errors");

  if (status === 401) {
    return { code: "unauthorized", message: t("unauthorized") };
  }
  if (status === 403) {
    return { code: "forbidden", message: t("permission_denied") };
  }
  if (status === 404) {
    return { code: "not_found", message: t("not_found") };
  }
  if (status === 409) {
    if (reason === "delete") {
      return { code: "builtin_delete", message: t("builtin_protected") };
    }
    if (reason === "deactivate") {
      return { code: "builtin_deactivate", message: t("builtin_protected") };
    }
    if (reason === "duplicate") {
      return { code: "duplicate_label", message: t("duplicate_label") };
    }
    return { code: "conflict", message: t("conflict") };
  }
  if (status === 400 || status === 422) {
    return { code: "validation", message: t("validation") };
  }
  if (status === 429) {
    return { code: "rate_limited", message: t("rate_limited") };
  }

  // Never the error's own text: it is the API client's English "Failed to … (HTTP n)".
  return { code: "generic", message: t("generic") };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * List payment methods for a company, refetching from the BE on every call
 * so usage_count stays accurate after mutations.
 */
export async function listPaymentMethodsAction(
  companyId: string,
  includeInactive = false
): Promise<ActionResult<PaymentMethod[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  try {
    const data = await fetchPaymentMethods(companyId, { includeInactive });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

/**
 * Create a payment method and return the updated full list so the UI can
 * replace local state without optimistic mutation.
 */
export async function createPaymentMethodAction(
  companyId: string,
  label: string
): Promise<ActionResult<PaymentMethod[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId)) return invalid();
  const labelError = checkLabel(label);
  if (labelError) return labelError;
  try {
    await createPaymentMethod(companyId, label);
    // Refetch to get accurate usage_count and server-ordered list
    const data = await fetchPaymentMethods(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

/**
 * Update a payment method label and/or active state, then refetch the list.
 */
export async function updatePaymentMethodAction(
  companyId: string,
  id: string,
  patch: {
    label?: string;
    isActive?: boolean;
    isCompanyPayment?: boolean;
    isPersonalPayment?: boolean;
  }
): Promise<ActionResult<PaymentMethod[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(id)) return invalid();
  if (patch.label !== undefined) {
    const labelError = checkLabel(patch.label);
    if (labelError) return labelError;
  }
  try {
    await updatePaymentMethod(companyId, id, patch);
    const data = await fetchPaymentMethods(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}

/**
 * Delete a payment method, then refetch the list.
 * Built-in methods will return ok: false with code "builtin_delete".
 */
export async function deletePaymentMethodAction(
  companyId: string,
  id: string
): Promise<ActionResult<PaymentMethod[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(id)) return invalid();
  try {
    await deletePaymentMethod(companyId, id);
    const data = await fetchPaymentMethods(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await classifyBackendError(err) };
  }
}
