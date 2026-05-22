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
 * - 'not_found'            — payment method not found (404)
 * - 'forbidden'            — caller is not a company member (403)
 * - 'unauthorized'         — no valid JWT session (401)
 * - 'rate_limited'         — too many requests (429)
 * - 'validation'           — bad payload (400 / 422)
 * - 'generic'              — catch-all
 *
 * No Set-Cookie forwarding needed — reads existing JWT from session cookie.
 */

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

// Defense-in-depth: short-circuit before BE call when no session cookie.
async function requireSession(): Promise<
  { ok: true } | { ok: false; error: { code: string; message: string } }
> {
  const session = await getSession();
  if (!session?.accessToken) {
    return {
      ok: false,
      error: { code: "unauthorized", message: "Session expired. Please log in again." },
    };
  }
  return { ok: true };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function invalid(): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code: "validation", message: "Invalid identifier." } };
}

const MAX_LABEL_LEN = 64;

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

  if (status === 401) {
    return { code: "unauthorized", message: "Session expired. Please log in again." };
  }
  if (status === 403) {
    return { code: "forbidden", message: "You do not have permission to manage payment methods for this company." };
  }
  if (status === 404) {
    return { code: "not_found", message: "Payment method not found." };
  }
  if (status === 409) {
    if (reason === "delete") {
      return { code: "builtin_delete", message: "Built-in payment methods cannot be deleted." };
    }
    if (reason === "deactivate") {
      return { code: "builtin_deactivate", message: "Built-in payment methods cannot be deactivated." };
    }
    if (reason === "duplicate") {
      return { code: "duplicate_label", message: "A payment method with this label already exists." };
    }
    return { code: "conflict", message: "A conflict occurred. Please try again." };
  }
  if (status === 400 || status === 422) {
    return { code: "validation", message: "Invalid input. Please check your entry and try again." };
  }
  if (status === 429) {
    return { code: "rate_limited", message: "Too many requests. Please wait and try again." };
  }

  const fallbackMsg = e.message ?? "An unexpected error occurred.";
  return { code: "generic", message: fallbackMsg };
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
    return { ok: false, error: classifyBackendError(err) };
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
  if (
    typeof label !== "string" ||
    label.trim().length === 0 ||
    label.length > MAX_LABEL_LEN
  ) {
    return invalid();
  }
  try {
    await createPaymentMethod(companyId, label);
    // Refetch to get accurate usage_count and server-ordered list
    const data = await fetchPaymentMethods(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
  }
}

/**
 * Update a payment method label and/or active state, then refetch the list.
 */
export async function updatePaymentMethodAction(
  companyId: string,
  id: string,
  patch: { label?: string; isActive?: boolean }
): Promise<ActionResult<PaymentMethod[]>> {
  const auth = await requireSession();
  if (!auth.ok) return auth;
  if (!isUuid(companyId) || !isUuid(id)) return invalid();
  if (
    patch.label !== undefined &&
    (typeof patch.label !== "string" ||
      patch.label.trim().length === 0 ||
      patch.label.length > MAX_LABEL_LEN)
  ) {
    return invalid();
  }
  try {
    await updatePaymentMethod(companyId, id, patch);
    const data = await fetchPaymentMethods(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: classifyBackendError(err) };
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
    return { ok: false, error: classifyBackendError(err) };
  }
}
