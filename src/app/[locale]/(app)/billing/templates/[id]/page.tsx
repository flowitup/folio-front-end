/**
 * Template edit page — server component.
 *
 * Fetches the template by ID and renders BillingTemplateForm in edit mode.
 * Returns 404-style callout if template not found or access denied.
 *
 * Auth: handled by layout middleware.
 * Ownership: enforced by BE decorator — 404 on mismatch.
 */

import { notFound } from "next/navigation";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";
import { BillingTemplateForm } from "@/components/billing/billing-template-form";

interface EditTemplatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const { id } = await params;

  let template;
  try {
    template = await fetchBillingTemplate(id);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 404 || status === 401 || status === 403) {
      notFound();
    }
    // Unexpected error — propagate to Next.js error boundary.
    throw err;
  }

  return <BillingTemplateForm mode="edit" template={template} />;
}
