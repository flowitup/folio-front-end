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
    const result = await fetchBillingDocuments({
      kind,
      status,
      q: q || undefined,
      project_id: projectId,
      limit: BILLING_LIST_PAGE_SIZE * page, // accumulate pages so load-more shows all loaded docs
      offset: 0,
    });
    initialDocuments = result.items;
    initialTotal = result.total;
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
