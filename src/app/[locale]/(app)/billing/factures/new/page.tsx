/**
 * New facture page — server component.
 *
 * Fetches the user's attached companies server-side.
 * - 0 attached → renders NoAttachedCompaniesCallout instead of the form.
 * - 1+ attached → renders BillingDocumentForm with the company picker.
 *
 * Query params:
 *   ?from=<id>       — pre-load source document (clone mode)
 *   ?template=<id>   — pre-load template (apply-template mode)
 */

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import { NoAttachedCompaniesCallout } from "@/components/billing/no-attached-companies-callout";
import type { BillingDocument, BillingDocumentTemplate } from "@/types/billing";
import type { MyCompany } from "@/types/companies";

interface NewFacturePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewFacturePage({ searchParams }: NewFacturePageProps) {
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : undefined;
  const templateId = typeof params.template === "string" ? params.template : undefined;

  // Fetch attached companies — required before allowing document creation.
  let attachedCompanies: MyCompany[] = [];
  try {
    attachedCompanies = await fetchMyCompanies();
  } catch {
    console.warn("[NewFacturePage] Could not fetch attached companies.");
  }

  if (attachedCompanies.length === 0) {
    return <NoAttachedCompaniesCallout />;
  }

  // Optional: pre-load source document for clone mode
  let sourceDoc: BillingDocument | undefined;
  if (fromId) {
    try {
      sourceDoc = await fetchBillingDocument(fromId);
    } catch {
      console.warn("[NewFacturePage] Could not load source document:", fromId);
    }
  }

  // Optional: pre-load template for apply-template mode
  let templateDoc: BillingDocumentTemplate | undefined;
  if (templateId && !sourceDoc) {
    try {
      templateDoc = await fetchBillingTemplate(templateId);
    } catch {
      console.warn("[NewFacturePage] Could not load template:", templateId);
    }
  }

  return (
    <BillingDocumentForm
      mode="create"
      kind="facture"
      attachedCompanies={attachedCompanies}
      initialFromSource={sourceDoc}
      initialFromTemplate={templateDoc}
    />
  );
}
