/**
 * Templates list page — server component.
 *
 * Fetches all billing document templates for the current user and passes
 * them to BillingTemplatesList (client) for grouped rendering.
 *
 * Auth: handled by layout middleware.
 * Error handling: API failures render empty state; component handles gracefully.
 */

import { fetchBillingTemplates } from "@/lib/api/billing/templates";
import { BillingTemplatesList } from "@/components/billing/billing-templates-list";
import type { BillingDocumentTemplate } from "@/types/billing";

export default async function TemplatesPage() {
  let initialTemplates: BillingDocumentTemplate[] = [];

  try {
    initialTemplates = await fetchBillingTemplates();
  } catch (err) {
    // Log server-side; render empty state gracefully.
    console.error("[TemplatesPage] Failed to fetch billing templates:", err);
  }

  return <BillingTemplatesList initialTemplates={initialTemplates} />;
}
