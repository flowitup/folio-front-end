/**
 * Factures list page — server component.
 *
 * Auth: handled by layout middleware — no explicit guard needed here.
 * Loading, URL parsing and error handling live in BillingListPage.
 */

import { BillingListPage } from "@/app/[locale]/(app)/billing/_components/billing-list-page";

interface FacturesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FacturesPage({ searchParams }: FacturesPageProps) {
  return <BillingListPage kind="facture" searchParams={await searchParams} />;
}
