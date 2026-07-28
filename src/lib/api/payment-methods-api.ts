/**
 * Payment methods API wrappers — server-only.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client components.
 * Client components must go through payment-methods-actions.ts server actions.
 *
 * Endpoints:
 *   GET    /api/v1/companies/<id>/payment-methods
 *   POST   /api/v1/companies/<id>/payment-methods
 *   PATCH  /api/v1/companies/<id>/payment-methods/<pm_id>
 *   DELETE /api/v1/companies/<id>/payment-methods/<pm_id>
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaymentMethod = {
  id: string;
  companyId: string;
  label: string;
  isBuiltin: boolean;
  isActive: boolean;
  usageCount: number;
  /** True when invoices paid with this method are counted as direct company spend. */
  isCompanyPayment: boolean;
  /** True when invoices paid with this method are counted as personal spend. Mutually exclusive with isCompanyPayment. */
  isPersonalPayment: boolean;
};

// Raw snake_case shape from the BE
interface PaymentMethodRaw {
  id: string;
  company_id: string;
  label: string;
  is_builtin: boolean;
  is_active: boolean;
  usage_count: number;
  is_company_payment: boolean;
  is_personal_payment: boolean;
}

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

function mapPaymentMethod(raw: PaymentMethodRaw): PaymentMethod {
  return {
    id: raw.id,
    companyId: raw.company_id,
    label: raw.label,
    isBuiltin: raw.is_builtin,
    isActive: raw.is_active,
    usageCount: raw.usage_count,
    isCompanyPayment: raw.is_company_payment ?? false,
    isPersonalPayment: raw.is_personal_payment ?? false,
  };
}

// ---------------------------------------------------------------------------
// API wrappers
// ---------------------------------------------------------------------------

/**
 * List payment methods for a company.
 * GET /api/v1/companies/<companyId>/payment-methods?include_inactive=false
 */
export async function fetchPaymentMethods(
  companyId: string,
  opts?: { includeInactive?: boolean }
): Promise<PaymentMethod[]> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams();
  if (opts?.includeInactive) {
    params.set("include_inactive", "true");
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/payment-methods${qs}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching payment methods: ${String(err)}`);
  }
  if (!response.ok)
    throw await buildHttpError(response, "Failed to fetch payment methods");
  const data = (await response.json()) as { items: PaymentMethodRaw[] };
  return data.items.map(mapPaymentMethod);
}

/**
 * Create a new payment method for a company.
 * POST /api/v1/companies/<companyId>/payment-methods
 */
export async function createPaymentMethod(
  companyId: string,
  label: string
): Promise<PaymentMethod> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/payment-methods`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ label }),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error creating payment method: ${String(err)}`);
  }
  if (!response.ok)
    throw await buildHttpError(response, "Failed to create payment method");
  return mapPaymentMethod((await response.json()) as PaymentMethodRaw);
}

/**
 * Update a payment method (label and/or is_active).
 * PATCH /api/v1/companies/<companyId>/payment-methods/<id>
 *
 * Note: built-in methods cannot be deactivated or deleted (BE returns 409).
 */
export async function updatePaymentMethod(
  companyId: string,
  id: string,
  patch: {
    label?: string;
    isActive?: boolean;
    isCompanyPayment?: boolean;
    isPersonalPayment?: boolean;
  }
): Promise<PaymentMethod> {
  const authHeaders = await sessionAuthHeader();
  const body: Record<string, unknown> = {};
  if (patch.label !== undefined) body["label"] = patch.label;
  if (patch.isActive !== undefined) body["is_active"] = patch.isActive;
  if (patch.isCompanyPayment !== undefined) body["is_company_payment"] = patch.isCompanyPayment;
  if (patch.isPersonalPayment !== undefined) body["is_personal_payment"] = patch.isPersonalPayment;

  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/payment-methods/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating payment method: ${String(err)}`);
  }
  if (!response.ok)
    throw await buildHttpError(response, "Failed to update payment method");
  return mapPaymentMethod((await response.json()) as PaymentMethodRaw);
}

/**
 * Delete a payment method.
 * DELETE /api/v1/companies/<companyId>/payment-methods/<id>
 *
 * Note: built-in methods cannot be deleted (BE returns 409 with reason="delete").
 */
export async function deletePaymentMethod(
  companyId: string,
  id: string
): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${baseUrl()}/companies/${encodeURIComponent(companyId)}/payment-methods/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error deleting payment method: ${String(err)}`);
  }
  if (!response.ok)
    throw await buildHttpError(response, "Failed to delete payment method");
}
