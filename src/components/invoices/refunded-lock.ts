/**
 * A refunded expense is locked by the API, its attachments included
 * ("Refunded expenses are locked; clear the refund status first").
 */
export function isRefundedLockError(err: unknown): boolean {
  const data = (err as { data?: { message?: unknown } } | null)?.data;
  const message =
    typeof data?.message === "string" ? data.message : err instanceof Error ? err.message : "";
  return /refunded expenses are locked/i.test(message);
}
