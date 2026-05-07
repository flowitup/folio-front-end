"use client";

/**
 * NoAttachedCompaniesCallout — empty-state card shown when a user has no company attached.
 *
 * Displayed in place of the billing document form when attachedCompanies.length === 0.
 * CTA links to /settings#my-companies so the user can attach or create a company.
 */

import { Link } from "@/i18n/navigation";
import { Building2 } from "lucide-react";
import { useTranslations } from "next-intl";

export function NoAttachedCompaniesCallout() {
  const t = useTranslations("companies.picker");

  return (
    <div className="fade-up px-8 py-12">
      <div className="folio-card flex max-w-lg flex-col items-start gap-4 p-6">
        <div className="flex items-center gap-3" style={{ color: "var(--ink)" }}>
          <Building2 size={20} className="shrink-0" />
          <p className="text-sm font-medium">{t("noCompaniesCalloutTitle")}</p>
        </div>
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {t("noCompaniesCalloutBody")}
        </p>
        <Link
          href="/settings#my-companies"
          className="rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors"
          style={{
            background: "var(--paper-2)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          {t("noCompaniesCalloutCta")}
        </Link>
      </div>
    </div>
  );
}
