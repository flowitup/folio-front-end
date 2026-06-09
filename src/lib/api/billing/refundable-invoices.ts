/**
 * Client-side API wrappers for the refundable materials & services expenses
 * endpoint. Uses the browser `api` client (cookie auth + CSRF) — safe to
 * import from client components.
 */

import { api } from "@/lib/api/http";
import type { RefundableExpense, RefundableStatus } from "@/types/invoice";

export interface FetchRefundableExpensesParams {
  companyId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch expenses already marked as refundable (refundable_status is set).
 * GET /billing/materials-expenses?refundable=true
 */
export async function fetchRefundableExpenses(
  params?: FetchRefundableExpensesParams
): Promise<{ items: RefundableExpense[]; total: number }> {
  const qs = new URLSearchParams({ refundable: "true" });
  if (params?.companyId) qs.set("company_id", params.companyId);
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.offset !== undefined) qs.set("offset", String(params.offset));

  return api.get<{ items: RefundableExpense[]; total: number }>(
    `/billing/materials-expenses?${qs.toString()}`
  );
}

/**
 * Fetch expenses NOT yet flagged for reimbursement (refundable_status is null).
 * GET /billing/materials-expenses?refundable=false
 */
export async function fetchRefundableCandidates(
  params?: FetchRefundableExpensesParams
): Promise<{ items: RefundableExpense[]; total: number }> {
  const qs = new URLSearchParams({ refundable: "false" });
  if (params?.companyId) qs.set("company_id", params.companyId);
  if (params?.limit !== undefined) qs.set("limit", String(params.limit));
  if (params?.offset !== undefined) qs.set("offset", String(params.offset));

  return api.get<{ items: RefundableExpense[]; total: number }>(
    `/billing/materials-expenses?${qs.toString()}`
  );
}

/**
 * Set or clear the refundable status of a materials & services invoice.
 * Passing null explicitly clears the status (removes from the refundable list).
 * PATCH /billing/materials-expenses/<invoice_id>
 */
export async function setRefundableStatus(
  invoiceId: string,
  status: RefundableStatus | null
): Promise<void> {
  await api.patch<void, { refundable_status: RefundableStatus | null }>(
    `/billing/materials-expenses/${encodeURIComponent(invoiceId)}`,
    { refundable_status: status }
  );
}
