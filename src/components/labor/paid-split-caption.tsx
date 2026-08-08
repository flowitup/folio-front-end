"use client";

/**
 * PaidSplitCaption — muted "Company 550 € · Personal 4 042,50 €" one-liner
 * under a Paid amount. Renders only the non-zero halves, and nothing at all
 * when both are zero.
 *
 * The figures come from the payments-summary flagged-method split
 * (company_paid/personal_paid), so amounts paid with no method or an
 * unflagged one appear in neither half — the caption may sum to less than
 * the Paid figure above it.
 */

import { useTranslations } from "next-intl";
import { formatEUR } from "@/lib/api/labor";

export interface PaidSplitCaptionProps {
  company: number;
  personal: number;
  testId?: string;
}

export function PaidSplitCaption({ company, personal, testId }: PaidSplitCaptionProps) {
  const t = useTranslations("labor.payments");
  const parts: string[] = [];
  if (company > 0) parts.push(t("companyShare", { amount: formatEUR(company) }));
  if (personal > 0) parts.push(t("personalShare", { amount: formatEUR(personal) }));
  if (parts.length === 0) return null;
  return (
    <div className="num" style={{ fontSize: 10.5, color: "var(--muted)" }} data-testid={testId}>
      {parts.join(" · ")}
    </div>
  );
}
