/**
 * Devis list page — server component.
 *
 * Auth: handled by layout middleware — no explicit guard needed here.
 * Loading, URL parsing and error handling live in BillingListPage.
 */

import { BillingListPage } from "@/app/[locale]/(app)/billing/_components/billing-list-page";

interface DevisPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DevisPage({ searchParams }: DevisPageProps) {
  return <BillingListPage kind="devis" searchParams={await searchParams} />;
}
