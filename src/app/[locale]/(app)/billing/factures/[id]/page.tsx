/**
 * Edit facture page — server component.
 *
 * Fetches the billing document and the user's attached companies server-side.
 * Passes both to BillingDocumentForm in edit mode; the picker is locked
 * (read-only) after creation.
 */

import { notFound } from "next/navigation";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { MyCompany } from "@/types/companies";

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

  // Best-effort fetch for attached companies — used to resolve issuer display name.
  let attachedCompanies: MyCompany[] = [];
  try {
    attachedCompanies = await fetchMyCompanies();
  } catch {
    console.warn("[EditFacturePage] Could not fetch attached companies.");
  }

  return (
    <BillingDocumentForm
      mode="edit"
      kind="facture"
      document={document}
      attachedCompanies={attachedCompanies}
    />
  );
}
