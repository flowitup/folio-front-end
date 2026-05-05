/**
 * New template page — server component.
 *
 * Optional query param:
 *   ?kind=devis|facture  — pre-selects the kind select in the form.
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

  return <BillingTemplateForm mode="create" initialKind={initialKind} />;
}
