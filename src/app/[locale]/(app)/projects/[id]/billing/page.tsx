/**
 * Project quotes & invoices page — server component.
 *
 * Lists the billing documents (devis + factures) linked to this project. The
 * backend endpoint only needs project:read, but every row links into the
 * /billing section, which is company-admin only — and the documents are the
 * project's company's — so the page is for admins of the project's company
 * (isCompanyAdmin on project.company_id) and sends anyone else away. When the
 * project cannot be read here it falls back to the /billing gate
 * (hasBillingAccess), as billing/layout.tsx does. The list itself loads client-side in
 * ProjectBillingPanel (loading, error and empty states live there); the
 * Topbar renders the title via TOPBAR_KEYS.billing.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { hasBillingAccess } from "@/lib/auth/billing-access";
import { isCompanyAdmin } from "@/lib/auth/permissions";
import { getProjectById } from "@/lib/api/projects-server";
import { ProjectBillingPanel } from "./project-billing-panel";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = pageTitle("navigation.quotesInvoices");

export default async function ProjectBillingPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const projectCompanyId = await getProjectById(projectId).then(
    (project) => project?.company_id ?? null,
    () => null,
  );
  const allowed = projectCompanyId
    ? isCompanyAdmin(session.user.companies, projectCompanyId, session.user.permissions)
    : await hasBillingAccess();
  if (!allowed) {
    redirect(`/${locale}/projects/${projectId}`);
  }

  return <ProjectBillingPanel key={projectId} projectId={projectId} />;
}
