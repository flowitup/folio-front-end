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
import type { RefundChannel } from "@/lib/api/billing/refundable-invoices";

interface RefundableSummaryCardsProps {
  summary: RefundableSummary | null;
  /** The channel the list is filtered on (its card reads as pressed). */
  activeChannel?: RefundChannel | null;
  /** Makes the two "still owed" cards filter the list (null clears). */
  onSelectChannel?: (channel: RefundChannel | null) => void;
}

/** Round part/whole to a whole display percent (0 when whole is 0). */
function toPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export function RefundableSummaryCards({
  summary,
  activeChannel = null,
  onSelectChannel,
}: RefundableSummaryCardsProps) {
  const t = useTranslations("billing.refundable");

  if (!summary) return null;

  const {
    refundable_amount,
    refunded_total,
    refunded_by_company,
    refunded_by_bank,
    refunded_by_both = 0,
    bank_outstanding,
  } = summary;
  // A "still owed" card is a filter of the list: pressing it again clears it.
  const owedCard = (
    channel: RefundChannel,
    label: string,
    hint: string,
    amount: number,
    color: string,
    testId: string
  ) => {
    const body = (
      <Card data-testid={testId} className={activeChannel === channel ? "ring-2 ring-[var(--accent)]" : undefined}>
        <CardContent className="space-y-1">
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className={`tabular-nums font-semibold text-lg ${color}`}>{formatEUR(amount)}</p>
        </CardContent>
      </Card>
    );
    if (!onSelectChannel) return <div title={hint}>{body}</div>;
    return (
      <button
        type="button"
        className="block w-full cursor-pointer rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2"
        title={hint}
        aria-pressed={activeChannel === channel}
        data-testid={`${testId}-filter`}
        onClick={() => onSelectChannel(activeChannel === channel ? null : channel)}
      >
        {body}
      </button>
    );
  };
  // The company/bank cards are INVOLVEMENT figures: an expense refunded by
  // both sides counts in full in each. The "Total refunded" card is the sum
  // of the two — the total of reimbursement FLOWS — so a both-refunded
  // expense contributes twice (once per side). refunded_total (the unique
  // expense sum) remains the bar's denominator: the bar shows three
  // EXCLUSIVE segments (company-only / both / bank-only) that sum to it.
  const totalRefundFlows = refunded_by_company + refunded_by_bank;
  const companyOnly = refunded_by_company - refunded_by_both;
  const bankOnly = refunded_by_bank - refunded_by_both;
  const companyPercent = toPercent(companyOnly, refunded_total);
  const bothPercent = toPercent(refunded_by_both, refunded_total);
  // Last segment is the complement so the three labels always sum to 100%
  // (independent rounding could read 99% or 101%).
  const bankPercent = refunded_total > 0 ? 100 - companyPercent - bothPercent : 0;

  return (
    <div data-testid="refundable-summary-cards">
      <div className={`grid grid-cols-2 gap-3 ${bank_outstanding !== undefined ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <Card data-testid="summary-card-refunded-total">
          <CardContent className="space-y-1">
            <p className="text-xs uppercase text-muted-foreground">{t("summary.refundedTotal")}</p>
            <p className="tabular-nums font-semibold text-lg">{formatEUR(totalRefundFlows)}</p>
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

        {owedCard(
          "company",
          t("summary.refundable"),
          t("summary.refundableHint"),
          refundable_amount,
          "text-amber-700",
          "summary-card-refundable"
        )}
        {bank_outstanding !== undefined &&
          owedCard(
            "bank",
            t("summary.bankOutstanding"),
            t("summary.bankOutstandingHint"),
            bank_outstanding,
            "text-sky-700",
            "summary-card-bank-outstanding"
          )}
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
              className="bg-teal-500"
              style={{ width: `${bothPercent}%` }}
              data-testid="refund-split-bar-both"
            />
            <div
              className="bg-sky-600"
              style={{ width: `${bankPercent}%` }}
              data-testid="refund-split-bar-bank"
            />
          </div>
          <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{t("summary.companyShare", { percent: companyPercent })}</span>
            {refunded_by_both > 0 && (
              <span data-testid="refund-split-bar-both-label">
                {t("summary.bothShare", { percent: bothPercent })}
              </span>
            )}
            <span>{t("summary.bankShare", { percent: bankPercent })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
