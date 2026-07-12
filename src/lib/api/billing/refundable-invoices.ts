/**
 * Client-side API wrappers for the refundable materials & services expenses
 * endpoint. Uses the browser `api` client (cookie auth + CSRF) — safe to
 * import from client components.
 */

import { api } from "@/lib/api/http";
import type { RefundableExpense, RefundableStatus, RefundableSummary, RefundedBy } from "@/types/invoice";

export interface FetchRefundableExpensesParams {
  companyId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch expenses already marked as refundable (refundable_status is set).
 * GET /billing/materials-expenses?refundable=true
 *
 * Defaults to limit=200 (backend max) so large companies do not silently
 * receive a truncated list. The caller may pass a lower limit explicitly.
 */
export async function fetchRefundableExpenses(
  params?: FetchRefundableExpensesParams
): Promise<{ items: RefundableExpense[]; total: number; summary: RefundableSummary | null }> {
  const qs = new URLSearchParams({ refundable: "true" });
  if (params?.companyId) qs.set("company_id", params.companyId);
  const limit = params?.limit !== undefined ? params.limit : 200;
  qs.set("limit", String(limit));
  if (params?.offset !== undefined) qs.set("offset", String(params.offset));

  return api.get<{ items: RefundableExpense[]; total: number; summary: RefundableSummary | null }>(
    `/billing/materials-expenses?${qs.toString()}`
  );
}

/**
 * Fetch expenses NOT yet flagged for reimbursement (refundable_status is null).
 * GET /billing/materials-expenses?refundable=false
 *
 * Defaults to limit=200 (backend max) so the picker is not silently truncated
 * for large companies. The caller may pass a lower limit explicitly.
 */
export async function fetchRefundableCandidates(
  params?: FetchRefundableExpensesParams
): Promise<{ items: RefundableExpense[]; total: number }> {
  const qs = new URLSearchParams({ refundable: "false" });
  if (params?.companyId) qs.set("company_id", params.companyId);
  const limit = params?.limit !== undefined ? params.limit : 200;
  qs.set("limit", String(limit));
  if (params?.offset !== undefined) qs.set("offset", String(params.offset));

  return api.get<{ items: RefundableExpense[]; total: number }>(
    `/billing/materials-expenses?${qs.toString()}`
  );
}

/**
 * Set or clear the refundable status of a materials & services invoice.
 * Passing null explicitly clears the status (removes from the refundable list).
 * `refundedBy` is only meaningful when `status === "refunded"`; the backend
 * defaults it to "company" when omitted while setting 'refunded', and clears
 * it server-side for any non-refunded status.
 * PATCH /billing/materials-expenses/<invoice_id>
 */
export async function setRefundableStatus(
  invoiceId: string,
  status: RefundableStatus | null,
  refundedBy?: RefundedBy
): Promise<void> {
  await api.patch<void, { refundable_status: RefundableStatus | null; refunded_by: RefundedBy | null }>(
    `/billing/materials-expenses/${encodeURIComponent(invoiceId)}`,
    { refundable_status: status, refunded_by: refundedBy ?? null }
  );
}
