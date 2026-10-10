/**
 * New devis page — server component.
 *
 * Fetches the companies the user may issue from (admin role) server-side:
 * the API refuses billing in a company where the user is only a member.
 * - 0 such companies → renders NoAttachedCompaniesCallout instead of the form.
 * - 1+ → renders BillingDocumentForm with the company picker.
 *
 * Query params:
 *   ?from=<id>       — pre-load source document (clone mode)
 *   ?template=<id>   — pre-load template (apply-template mode)
 *
 * Both pre-loads are best-effort: if the API is unavailable the fallback is
 * a blank form with a non-fatal console warning.
 */

import { fetchBillingIssuerCompanies } from "@/lib/billing/billing-issuer-companies";
import { fetchBillingDocument } from "@/lib/api/billing/documents";
import { fetchBillingTemplate } from "@/lib/api/billing/templates";
import { listProjects } from "@/lib/api/projects-server";
import { BillingDocumentForm } from "@/components/billing/billing-document-form";
import { NoAttachedCompaniesCallout } from "@/components/billing/no-attached-companies-callout";
import type { BillingDocument, BillingDocumentTemplate } from "@/types/billing";
import type { MyCompany } from "@/types/companies";
import type { ProjectSummary } from "@/lib/api/projects-server";

interface NewDevisPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewDevisPage({ searchParams }: NewDevisPageProps) {
  const params = await searchParams;
  const fromId = typeof params.from === "string" ? params.from : undefined;
  const templateId = typeof params.template === "string" ? params.template : undefined;

  // Companies the user administers — required before allowing document creation
  // (a load failure reads as none, which shows the callout).
  const attachedCompanies: MyCompany[] = await fetchBillingIssuerCompanies();

  if (attachedCompanies.length === 0) {
    return <NoAttachedCompaniesCallout />;
  }

  // Fetch projects for the project picker (best-effort; form still renders on error).
  let projects: ProjectSummary[] = [];
  try {
    projects = await listProjects();
  } catch {
    console.warn("[NewDevisPage] Could not fetch projects.");
  }

  // Optional: pre-load source document for clone mode
  let sourceDoc: BillingDocument | undefined;
  if (fromId) {
    try {
      sourceDoc = await fetchBillingDocument(fromId);
    } catch {
      console.warn("[NewDevisPage] Could not load source document:", fromId);
    }
  }

  // Optional: pre-load template for apply-template mode
  let templateDoc: BillingDocumentTemplate | undefined;
  if (templateId && !sourceDoc) {
    try {
      templateDoc = await fetchBillingTemplate(templateId);
    } catch {
      console.warn("[NewDevisPage] Could not load template:", templateId);
    }
  }

  return (
    <BillingDocumentForm
      mode="create"
      kind="devis"
      attachedCompanies={attachedCompanies}
      projects={projects}
      initialFromSource={sourceDoc}
      initialFromTemplate={templateDoc}
    />
  );
}
