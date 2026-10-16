/**
 * Inventory page — RSC shell.
 *
 * Resolves the active company_id server-side (same rule as the bibliotheque
 * page: primary company, else the first attached one) and hands it to the
 * client component, which owns every list and dialog.
 *
 * Auth: handled by the (app) layout — no explicit guard needed here.
 */

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { InventoryPageClient } from "./inventory-page-client";
import { getLocale, getTranslations } from "next-intl/server";
import { redirectToOnboardingIfNeeded } from "@/lib/auth/onboarding-redirect";
import { pageTitle } from "@/lib/i18n/page-title";
import { pickPageCompany, toPageCompanies, type PageCompany } from "@/lib/companies/page-company";
import { companiesShowingArea } from "@/lib/companies/hidden-sections";
import { redirect } from "next/navigation";

export const generateMetadata = pageTitle("navigation.inventory");

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InventoryPage({ searchParams }: PageProps) {
  // Onboarding gate (as on /dashboard and /projects): a user with no company
  // is sent to create or join one rather than shown an empty page.
  await redirectToOnboardingIfNeeded(await getLocale());

  let companyId: string | null = null;
  let companies: PageCompany[] = [];
  let areaHidden = false;

  try {
    // ?company= (the picker), else the primary company, else the oldest attachment.
    // Companies that turned this area off (Settings › Company › Hidden
    // sections) are left out; when every company did, the page is hidden.
    const mine = await fetchMyCompanies();
    const showing = companiesShowingArea(mine, "inventory");
    areaHidden = mine.length > 0 && showing.length === 0;
    companyId = pickPageCompany(showing, (await searchParams)?.company)?.id ?? null;
    companies = toPageCompanies(showing);
  } catch (err) {
    console.error("[InventoryPage] Could not fetch attached companies.", err);
  }

  if (areaHidden) redirect(`/${await getLocale()}/dashboard`);

  if (!companyId) {
    const t = await getTranslations("inventory");
    return (
      <div className="px-4 pb-12 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
        </div>
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noCompany")}
          </p>
        </div>
      </div>
    );
  }

  return <InventoryPageClient key={companyId} companyId={companyId} companies={companies} />;
}
