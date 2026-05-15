/**
 * Devis list page — server component.
 *
 * Fetches the first page of billing documents with kind=devis and passes
 * the result as initial props to the shared BillingDocumentList client component.
 *
 * Auth: handled by layout middleware — no explicit guard needed here.
 * Error handling: API failures render an empty initial state; the client
 * component displays the empty-state UI. Errors are logged server-side.
 */

import { fetchBillingDocuments } from "@/lib/api/billing/documents";
import { BillingDocumentList } from "@/app/[locale]/(app)/billing/_components/billing-document-list";
import type { BillingDocument, BillingDocumentStatus } from "@/types/billing";

const PAGE_SIZE = 25;

interface DevisPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DevisPage({ searchParams }: DevisPageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const statusParam = typeof params.status === "string" ? params.status : undefined;

  let initialDocuments: BillingDocument[] = [];
  let initialTotal = 0;

  try {
    const result = await fetchBillingDocuments({
      kind: "devis",
      status: statusParam as BillingDocumentStatus | undefined,
      limit: PAGE_SIZE * page, // accumulate pages so load-more shows all loaded docs
      offset: 0,
    });
    initialDocuments = result.items;
    initialTotal = result.total;
  } catch (err) {
    // Log server-side; render empty state — client shows empty UI gracefully.
    console.error(
      "[DevisPage] Failed to fetch billing documents:",
      err instanceof Error ? err.message : "unknown"
    );
  }

  return (
    <BillingDocumentList
      kind="devis"
      initialDocuments={initialDocuments}
      initialTotal={initialTotal}
    />
  );
}
