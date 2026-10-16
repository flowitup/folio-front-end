/**
 * Bibliothèque page — RSC shell.
 *
 * Resolves the active company_id server-side (mirrors billing pages pattern:
 * fetchMyCompanies → primary company or first attached). Passes company_id
 * down to the client component so it never has to refetch companies in the
 * browser.
 *
 * Auth: handled by layout middleware — no explicit guard needed here.
 */

import { fetchMyCompanies } from "@/lib/api/companies/companies";
import { BibliothequePageClient } from "./bibliotheque-page-client";
import { getLocale, getTranslations } from "next-intl/server";
import { redirectToOnboardingIfNeeded } from "@/lib/auth/onboarding-redirect";
import { pageTitle } from "@/lib/i18n/page-title";
import { pickPageCompany, toPageCompanies, type PageCompany } from "@/lib/companies/page-company";

export const generateMetadata = pageTitle("navigation.bibliotheque");

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BibliothequePage({ searchParams }: PageProps) {
  // Onboarding gate (as on /dashboard and /projects): a user with no company
  // is sent to create or join one rather than shown an empty page.
  await redirectToOnboardingIfNeeded(await getLocale());

  let companyId: string | null = null;
  let companies: PageCompany[] = [];

  try {
    // ?company= (the picker), else the primary company, else the oldest attachment.
    const mine = await fetchMyCompanies();
    companyId = pickPageCompany(mine, (await searchParams)?.company)?.id ?? null;
    companies = toPageCompanies(mine);
  } catch (err) {
    console.error("[BibliothequePage] Could not fetch attached companies.", err);
  }

  if (!companyId) {
    const t = await getTranslations("bibliotheque");
    return (
      <div className="px-4 pb-12 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
        </div>
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noResults")}
          </p>
        </div>
      </div>
    );
  }

  return <BibliothequePageClient key={companyId} companyId={companyId} companies={companies} />;
}
