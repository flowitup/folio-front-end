/**
 * Edit devis page — server component.
 *
 * Fetches the billing document and the user's attached companies server-side.
 * Passes both to BillingDocumentForm in edit mode; the picker is locked
 * (read-only) after creation.
 */

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import type { MyCompany } from "@/types/companies";

interface EditDevisPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditDevisPage({ params }: EditDevisPageProps) {
  const { id } = await params;
  const t = await getTranslations("billing.editPage");

  let document;
  try {
    document = await fetchBillingDocument(id);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) notFound();
    console.error("[EditDevisPage] Failed to fetch document:", id, err);
    return (
      <div className="fade-up px-8 py-12">
        <div className="folio-card p-6">
          <p className="text-sm font-medium text-red-600">
            {t("loadFailed")}
          </p>
        </div>
      </div>
    );
  }

  // Kind mismatch guard — URL says /devis but document is a facture
  if (document.kind !== "devis") notFound();

  // Best-effort fetch for attached companies — used to resolve issuer display name.
  let attachedCompanies: MyCompany[] = [];
  try {
    attachedCompanies = await fetchMyCompanies();
  } catch {
    console.warn("[EditDevisPage] Could not fetch attached companies.");
  }

  return (
    <BillingDocumentForm
      mode="edit"
      kind="devis"
      document={document}
      attachedCompanies={attachedCompanies}
    />
  );
}
