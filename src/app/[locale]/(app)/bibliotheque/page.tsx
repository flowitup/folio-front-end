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
import { getTranslations } from "next-intl/server";

export default async function BibliothequePage() {
  let companyId: string | null = null;

  try {
    const companies = await fetchMyCompanies();
    if (companies.length > 0) {
      const primary = companies.find((c) => c.is_primary);
      companyId = (primary ?? companies[0]).id;
    }
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

  return <BibliothequePageClient companyId={companyId} />;
}
