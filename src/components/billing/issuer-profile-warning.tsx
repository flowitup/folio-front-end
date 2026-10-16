"use client";

/**
 * IssuerProfileWarning — before a devis or facture is issued, says which
 * legal mentions the issuing company has not filled in (SIRET, TVA number,
 * IBAN) and links to its profile. Without them the PDF carries only the name
 * and address (QA round 3, sweep-new-company-journey-22).
 */

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface IssuerProfileFields {
  id: string;
  legal_name: string;
  siret?: string | null;
  tva_number?: string | null;
  iban?: string | null;
}

/** Keys (billing.form.issuerProfile.fields.*) of the mentions the company lacks. */
export function missingIssuerFields(company: IssuerProfileFields): ("siret" | "tvaNumber" | "iban")[] {
  const missing: ("siret" | "tvaNumber" | "iban")[] = [];
  if (!company.siret?.trim()) missing.push("siret");
  if (!company.tva_number?.trim()) missing.push("tvaNumber");
  if (!company.iban?.trim()) missing.push("iban");
  return missing;
}

export function IssuerProfileWarning({ company }: { company: IssuerProfileFields | null | undefined }) {
  const t = useTranslations("billing.form.issuerProfile");
  const locale = useLocale();
  if (!company) return null;
  const missing = missingIssuerFields(company);
  if (missing.length === 0) return null;
  return (
    <Alert data-testid="issuer-profile-warning">
      <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
        <span>
          {t("missing", {
            company: company.legal_name,
            fields: missing.map((f) => t(`fields.${f}`)).join(", "),
          })}
        </span>
        <Link href={`/${locale}/settings/companies/${company.id}`} className="font-medium underline">
          {t("complete")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
