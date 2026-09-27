/**
 * Reading the devis / factures list URL (?page=, ?status=, ?q=, ?project_id=)
 * the same way on the server page and in the client list. Bad values fall back
 * to their defaults instead of reaching the API (a NaN limit or an unknown
 * status is a 400, which used to show the "no documents yet" state).
 */

import type { BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";

export const BILLING_LIST_PAGE_SIZE = 25;

export const DEVIS_STATUSES: BillingDocumentStatus[] = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
];

export const FACTURE_STATUSES: BillingDocumentStatus[] = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
];

export function statusesFor(kind: BillingDocumentKind): BillingDocumentStatus[] {
  return kind === "devis" ? DEVIS_STATUSES : FACTURE_STATUSES;
}

/** A page number of 1 or more; anything else ("abc", "1.5", "-2") is page 1. */
export function parsePage(raw: string | null | undefined): number {
  const text = (raw ?? "").trim();
  if (!/^\d+$/.test(text)) return 1;
  const n = Number.parseInt(text, 10);
  return n >= 1 ? n : 1;
}

/** The status when it is one of the kind's statuses, else undefined (= all). */
export function parseStatus(
  kind: BillingDocumentKind,
  raw: string | null | undefined
): BillingDocumentStatus | undefined {
  return statusesFor(kind).find((s) => s === raw);
}

/** The server-side search text (the API reads at most 100 characters). */
export function parseQuery(raw: string | null | undefined): string {
  return (raw ?? "").trim().slice(0, 100);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseProjectId(raw: string | null | undefined): string | undefined {
  return raw && UUID_RE.test(raw) ? raw : undefined;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBillingListParams(kind: BillingDocumentKind, params: RawParams) {
  return {
    page: parsePage(first(params.page)),
    status: parseStatus(kind, first(params.status)),
    q: parseQuery(first(params.q)),
    projectId: parseProjectId(first(params.project_id)),
  };
}
