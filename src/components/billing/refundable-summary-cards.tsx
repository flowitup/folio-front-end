"use client";

/**
 * RefundableSummaryCards — company-level KPI strip above the refundable
 * invoices table: total refunded, split by company vs. bank, and the
 * remaining outstanding (refundable) amount, aggregated over the full
 * filter set (not just the currently loaded page).
 *
 * Self-hides when summary is null (e.g. backend not yet returning it, or
 * no company context). Renders even when the list itself is empty, so an
 * admin can still see "0" totals rather than nothing.
 */

import { useTranslations } from "next-intl";
import { Building2, Landmark } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatEUR } from "@/lib/utils/formatters";
import type { RefundableSummary } from "@/types/invoice";

interface RefundableSummaryCardsProps {
  summary: RefundableSummary | null;
}

/** Round a 0-1 share to a whole percent for display. */
function toPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function RefundableSummaryCards({ summary }: RefundableSummaryCardsProps) {
  const t = useTranslations("billing.refundable");

  if (!summary) return null;

  const { refundable_amount, refunded_total, refunded_by_company, refunded_by_bank } = summary;
  const companyPercent = toPercent(refunded_by_company, refunded_total);
  const bankPercent = toPercent(refunded_by_bank, refunded_total);

  return (
    <div data-testid="refundable-summary-cards">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card data-testid="summary-card-refunded-total">
          <CardContent className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">{t("summary.refundedTotal")}</p>
            <p className="tabular-nums font-semibold text-lg">{formatEUR(refunded_total)}</p>
          </CardContent>
        </Card>

        <Card data-testid="summary-card-refunded-by-company">
          <CardContent className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
              <Building2 size={14} className="text-emerald-600" />
              {t("summary.refundedByCompany")}
            </p>
            <p className="tabular-nums font-semibold text-lg text-emerald-600">
              {formatEUR(refunded_by_company)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="summary-card-refunded-by-bank">
          <CardContent className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
              <Landmark size={14} className="text-sky-600" />
              {t("summary.refundedByBank")}
            </p>
            <p className="tabular-nums font-semibold text-lg text-sky-600">
              {formatEUR(refunded_by_bank)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="summary-card-refundable">
          <CardContent className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">{t("summary.refundable")}</p>
            <p className="tabular-nums font-semibold text-lg text-amber-600">
              {formatEUR(refundable_amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {refunded_total !== 0 && (
        <div className="mt-3" data-testid="refund-split-bar">
          <div className="flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-emerald-600"
              style={{ width: `${companyPercent}%` }}
              data-testid="refund-split-bar-company"
            />
            <div
              className="bg-sky-600"
              style={{ width: `${bankPercent}%` }}
              data-testid="refund-split-bar-bank"
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("summary.companyShare", { percent: companyPercent })}</span>
            <span>{t("summary.bankShare", { percent: bankPercent })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
