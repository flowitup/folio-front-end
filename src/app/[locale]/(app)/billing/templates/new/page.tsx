/**
 * New template page — server component.
 *
 * Optional query params:
 *   ?kind=devis|facture  — pre-selects the kind select in the form.
 *   ?company_id=<uuid>   — carried from the templates list's company picker
 *                          (BillingTemplatesCompanyScope) so the created
 *                          template lands in the company being viewed, not
 *                          always the caller's primary admin company.
 *
 * Renders BillingTemplateForm in create mode.
 * Auth: handled by layout middleware.
 */

import { BillingTemplateForm } from "@/components/billing/billing-template-form";
import type { BillingDocumentKind } from "@/types/billing";

interface NewTemplatePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTemplatePage({ searchParams }: NewTemplatePageProps) {
  const params = await searchParams;
  const kindParam = typeof params.kind === "string" ? params.kind : undefined;
  const initialKind: BillingDocumentKind | undefined =
    kindParam === "devis" || kindParam === "facture" ? kindParam : undefined;
  const initialCompanyId = typeof params.company_id === "string" ? params.company_id : undefined;

  return (
    <BillingTemplateForm mode="create" initialKind={initialKind} initialCompanyId={initialCompanyId} />
  );
}
