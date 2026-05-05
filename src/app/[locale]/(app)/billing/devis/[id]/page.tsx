/**
 * Edit devis page — server component.
 *
 * Fetches the billing document server-side; passes to BillingDocumentForm in
 * edit mode. On fetch failure (404, network) renders an error state.
 */

import { notFound } from "next/navigation";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";

interface EditDevisPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDevisPage({ params }: EditDevisPageProps) {
  const { id } = await params;

  let document;
  try {
    document = await fetchBillingDocument(id);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) notFound();
    // Network / server error — surface below
    console.error("[EditDevisPage] Failed to fetch document:", id, err);
    return (
      <div className="fade-up px-8 py-12">
        <div className="folio-card p-6">
          <p className="text-sm font-medium text-red-600">
            Failed to load document. Please refresh or try again later.
          </p>
        </div>
      </div>
    );
  }

  // Kind mismatch guard — URL says /devis but document is a facture
  if (document.kind !== "devis") notFound();

  return (
    <BillingDocumentForm
      mode="edit"
      kind="devis"
      document={document}
    />
  );
}
