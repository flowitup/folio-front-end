/**
 * Server half of the devis / factures list pages: reads the URL, loads the
 * accumulated pages (search, status and project applied by the API) and the
 * companies an import may be issued from, then renders BillingDocumentList.
 */

import { fetchBillingDocuments } from "@/lib/api/billing/documents";
import { fetchBillingIssuerCompanies } from "@/lib/billing/billing-issuer-companies";
import { BillingDocumentList } from "./billing-document-list";
import { BILLING_LIST_PAGE_SIZE, parseBillingListParams } from "./billing-list-params";
import type { BillingDocument, BillingDocumentKind } from "@/types/billing";

/** The most rows the API returns for one list request (pagination.py max_limit). */
const API_MAX_LIMIT = 200;

export async function BillingListPage({
  kind,
  searchParams,
}: {
  kind: BillingDocumentKind;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { page, status, q, projectId } = parseBillingListParams(kind, searchParams);

  let initialDocuments: BillingDocument[] = [];
  let initialTotal = 0;
  let loadError = false;

  // Companies an import may be issued from — loaded alongside the list (never throws).
  const issuerCompaniesPromise = fetchBillingIssuerCompanies();

  try {
    // Accumulate the pages so "load more" shows every loaded document. The API
    // caps one request at API_MAX_LIMIT rows, so a deep page is read in
    // chunks; asking for more in one go silently stopped the list at 200.
    const wanted = BILLING_LIST_PAGE_SIZE * page;
    const items: BillingDocument[] = [];
    let total = 0;
    while (items.length < wanted) {
      const limit = Math.min(API_MAX_LIMIT, wanted - items.length);
      const result = await fetchBillingDocuments({
        kind,
        status,
        q: q || undefined,
        project_id: projectId,
        limit,
        offset: items.length,
      });
      items.push(...result.items);
      total = result.total;
      if (result.items.length < limit) break; // nothing further
    }
    initialDocuments = items;
    // Never claim more than can be shown: "load more" hides once all are loaded.
    initialTotal = Math.max(total, items.length);
  } catch (err) {
    // A failed load is not an empty list: the client shows an error with a retry.
    loadError = true;
    console.error(
      `[BillingListPage:${kind}] Failed to fetch billing documents:`,
      err instanceof Error ? err.message : "unknown"
    );
  }

  const issuerCompanies = await issuerCompaniesPromise;

  return (
    <BillingDocumentList
      kind={kind}
      initialDocuments={initialDocuments}
      initialTotal={initialTotal}
      issuerCompanies={issuerCompanies}
      loadError={loadError}
    />
  );
}
