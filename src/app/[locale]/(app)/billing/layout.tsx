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

  return <>{children}</>;
}
