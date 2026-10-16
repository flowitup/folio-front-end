/**
 * Billing section layout — per-company admin gate.
 *
 * Billing is admin-gated per company: only a superadmin or a user who holds the
 * "admin" role in at least one company may view billing. Non-admin members are
 * redirected away so they never land on an empty/forbidden billing page.
 * Applies to every route under /billing (devis, factures, templates, details).
 */

import { redirect } from "next/navigation";
import { hasBillingAccess } from "@/lib/auth/billing-access";
import { getSession } from "@/lib/auth/session";
import { hiddenCompanyAreas } from "@/lib/companies/hidden-sections";
import { pageTitle } from "@/lib/i18n/page-title";

export const generateMetadata = pageTitle("navigation.quotesInvoices");

export default async function BillingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(await hasBillingAccess())) {
    redirect(`/${locale}`);
  }
  // Every company of the user turned billing off (Settings › Company › Hidden sections).
  const session = await getSession();
  if (hiddenCompanyAreas(session?.user.companies).has("billing")) {
    redirect(`/${locale}`);
  }

  return <>{children}</>;
}
