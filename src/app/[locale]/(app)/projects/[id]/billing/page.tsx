/**
 * Project quotes & invoices page — server component.
 *
 * Lists the billing documents (devis + factures) linked to this project. The
 * backend endpoint only needs project:read, but every row links into the
 * /billing section, which is company-admin only — so the page uses the same
 * gate as that section (hasBillingAccess) and sends anyone else away, exactly
 * like billing/layout.tsx does. The list itself loads client-side in
 * ProjectBillingPanel (loading, error and empty states live there); the
 * Topbar renders the title via TOPBAR_KEYS.billing.
 */

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { hasBillingAccess } from "@/lib/auth/billing-access";
import { ProjectBillingPanel } from "./project-billing-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectBillingPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  if (!(await hasBillingAccess())) {
    redirect(`/${locale}`);
  }

  return <ProjectBillingPanel key={projectId} projectId={projectId} />;
}
