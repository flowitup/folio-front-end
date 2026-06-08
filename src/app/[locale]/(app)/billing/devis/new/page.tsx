/**
 * New devis page — server component.
 *
 * Fetches the user's attached companies server-side.
 * - 0 attached → renders NoAttachedCompaniesCallout instead of the form.
 * - 1+ attached → renders BillingDocumentForm with the company picker.
 *
 * Query params:
 *   ?from=<id>       — pre-load source document (clone mode)
 *   ?template=<id>   — pre-load template (apply-template mode)
 *
 * Both pre-loads are best-effort: if the API is unavailable the fallback is
 * a blank form with a non-fatal console warning.
 */

import { fetchMyCompanies } from "@/lib/api/companies/companies";
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

  // Fetch attached companies — required before allowing document creation.
  let attachedCompanies: MyCompany[] = [];
  try {
    attachedCompanies = await fetchMyCompanies();
  } catch {
    // Network error — allow form to render with empty list; picker will show callout.
    console.warn("[NewDevisPage] Could not fetch attached companies.");
  }

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
