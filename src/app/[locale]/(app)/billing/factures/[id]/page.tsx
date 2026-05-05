/**
 * Edit facture page — server component.
 *
 * Fetches the billing document server-side; passes to BillingDocumentForm in
 * edit mode. On fetch failure (404, network) renders an error state.
 */

import { notFound } from "next/navigation";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";

interface EditFacturePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFacturePage({ params }: EditFacturePageProps) {
  const { id } = await params;

  let document;
  try {
    document = await fetchBillingDocument(id);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) notFound();
    console.error("[EditFacturePage] Failed to fetch document:", id, err);
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

  // Kind mismatch guard — URL says /factures but document is a devis
  if (document.kind !== "facture") notFound();

  return (
    <BillingDocumentForm
      mode="edit"
      kind="facture"
      document={document}
    />
  );
}
