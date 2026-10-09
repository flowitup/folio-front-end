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

export const generateMetadata = pageTitle("navigation.inventory");

export default async function InventoryPage() {
  // Onboarding gate (as on /dashboard and /projects): a user with no company
  // is sent to create or join one rather than shown an empty page.
  await redirectToOnboardingIfNeeded(await getLocale());

  let companyId: string | null = null;

  try {
    const companies = await fetchMyCompanies();
    if (companies.length > 0) {
      const primary = companies.find((c) => c.is_primary);
      companyId = (primary ?? companies[0]).id;
    }
  } catch (err) {
    console.error("[InventoryPage] Could not fetch attached companies.", err);
  }

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

  return <InventoryPageClient companyId={companyId} />;
}
