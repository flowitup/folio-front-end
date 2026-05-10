"use client";

import { Fragment, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LaborSummaryResponse, LaborMonthlySummaryResponse, MonthlySummaryRow } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";
import { LaborExportDialog } from "@/components/labor/labor-export-dialog";
import { capitalizeFirst } from "@/lib/utils/capitalize-first";

interface LaborSummaryProps {
  projectId: string;
  summary: LaborSummaryResponse | null;
  /** Per-month rollup. Used when no specific month filter is active. */
  monthlySummary: LaborMonthlySummaryResponse | null;
  isLoading: boolean;
  month: string;
  onMonthChange: (value: string) => void;
}

/** Format a (year, month) into a localized label like "May 2026". */
function formatYearMonthLabel(row: MonthlySummaryRow, locale: string): string {
  const d = new Date(row.year, row.month - 1, 1);
  return capitalizeFirst(
    d.toLocaleDateString(locale, { month: "long", year: "numeric" }),
    locale,
  );
}

function formatMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** Format bonus_days value: render integer without decimal, float with one decimal */
function formatBonusDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function LaborSummary({
  projectId,
  summary,
  monthlySummary,
  isLoading,
  month,
  onMonthChange,
}: LaborSummaryProps) {
  const t = useTranslations("labor");
  const locale = useLocale();
  const [exportOpen, setExportOpen] = useState(false);
  // Year filter — null = "All years". Only meaningful when month filter
  // is unset (we're in the all-history monthly-rollup view).
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // month === "" → unbounded "all history" summary. Switch labels + headers
  // to a localized "All history" string and hide the Clear button.
  const isAllHistory = month === "";
  const periodLabel = isAllHistory
    ? t("filterMonthAll")
    : formatMonthLabel(month, locale);

  // Year filter buttons — derived from the per-month rollup so we only
  // show years that actually have data. DESC.
  const availableYears = useMemo(() => {
    const ys = new Set<number>();
    monthlySummary?.rows.forEach((r) => ys.add(r.year));
    return Array.from(ys).sort((a, b) => b - a);
  }, [monthlySummary]);

  // Filtered monthly rows (apply year filter if one is selected).
  const filteredMonthlyRows = useMemo(() => {
    const rows = monthlySummary?.rows ?? [];
    return selectedYear == null ? rows : rows.filter((r) => r.year === selectedYear);
  }, [monthlySummary, selectedYear]);

  // KPI numbers: in all-history mode they roll up the monthly buckets
  // (filtered by year if set). In month mode they come from the per-worker
  // summary (existing behavior).
  const totalCost = isAllHistory
    ? filteredMonthlyRows.reduce((sum, r) => sum + r.total_cost, 0)
    : summary?.total_cost ?? 0;
  const totalDays = isAllHistory
    ? filteredMonthlyRows.reduce((sum, r) => sum + r.total_days, 0)
    : summary?.total_days ?? 0;
  const workerCount = summary?.rows.length ?? 0;
  const onSiteToday = workerCount;
  const avgDailyRate = totalDays > 0 ? totalCost / totalDays : 0;

  const totalBankedHours = summary?.total_banked_hours ?? 0;
  const totalBonusDays = summary?.total_bonus_days ?? 0;
  const totalBonusCost = summary?.total_bonus_cost ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Supplement banner — only shown when there are banked hours */}
      {totalBankedHours > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
          <p className="text-[13px] font-medium">
            {t("supplement.banner", {
              banked: totalBankedHours,
              bonusDays: formatBonusDays(totalBonusDays),
              bonusCost: formatEUR(totalBonusCost),
            })}
          </p>
        </div>
      )}

      {/* KPI Row — 4 base cards + optional bonus-cost card */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="folio-card p-5">
          <div className="label-cap">{t("totalLaborCost")}</div>
          <div className="font-display num mt-2 text-[28px] font-medium leading-none">
            {formatEUR(totalCost)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--positive)" }}>
            {periodLabel}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("workerDays")}</div>
          <div className="font-display num mt-2 text-[28px] font-medium leading-none">
            {totalDays}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("acrossWorkers", { n: workerCount })}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("onSiteToday")}</div>
          <div className="font-display num mt-2 text-[28px] font-medium leading-none">
            {onSiteToday}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("workersLogged")}
          </div>
        </div>
        <div className="folio-card p-5">
          <div className="label-cap">{t("avgDailyRate")}</div>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: "var(--accent)" }}
          >
            {formatEUR(avgDailyRate)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("perWorkerDay")}
          </div>
        </div>
        {/* Bonus cost KPI — always rendered to keep grid stable; value is 0 when no supplements */}
        <div className="folio-card p-5">
          <div className="label-cap">{t("supplement.bonusCost")}</div>
          <div
            className="font-display num mt-2 text-[28px] font-medium leading-none"
            style={{ color: "var(--accent)" }}
          >
            {formatEUR(totalBonusCost)}
          </div>
          <div className="num mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            {t("supplement.bonusDaysSubtitle", { days: formatBonusDays(totalBonusDays) })}
          </div>
        </div>
      </div>

      {/* Year filter — only shown when no specific month filter is active.
          Buttons derived from the data; horizontal scroll on overflow so
          mobile stays clean even when there are many years. */}
      {isAllHistory && availableYears.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" data-testid="year-filter-row">
          <button
            type="button"
            onClick={() => setSelectedYear(null)}
            className={`stamp num shrink-0 ${selectedYear == null ? "on" : ""}`}
            aria-pressed={selectedYear == null}
          >
            {t("summaryAllYears")}
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`stamp num shrink-0 ${selectedYear === y ? "on" : ""}`}
              aria-pressed={selectedYear === y}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      {/* Summary table */}
      <div className="folio-card overflow-hidden">
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[18px] font-medium tracking-tight">
              {isAllHistory
                ? selectedYear == null
                  ? t("summaryAllHistoryTitle")
                  : t("summaryYearTitle", { year: selectedYear })
                : t("monthlySummary", { month: periodLabel })}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => onMonthChange(e.target.value)}
              className="folio-input num"
              style={{ width: 160 }}
              placeholder={t("filterMonthAll")}
            />
            {!isAllHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMonthChange("")}
                aria-label={t("filterMonthClear")}
                title={t("filterMonthClear")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            {workerCount > 0 && !isAllHistory && (
              <span className="stamp num">{t("workersBadge", { n: workerCount })}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExportOpen(true)}
            >
              {t("export.button")}
            </Button>
          </div>
        </div>

        {/* Conditional body: month-grouped rows in all-history mode,
            per-worker table when a specific month is selected. */}
        {isAllHistory ? (
          filteredMonthlyRows.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {t("noEntries")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>{t("summaryMonthColumn")}</th>
                    <th style={{ textAlign: "right" }}>{t("daysWorked")}</th>
                    <th style={{ textAlign: "right" }}>{t("totalCost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyRows.map((row) => {
                    const ym = `${row.year}-${String(row.month).padStart(2, "0")}`;
                    return (
                      <Fragment key={ym}>
                        {/* Month header — clickable to drill into per-worker
                            mode for that month (existing behavior). */}
                        <tr
                          onClick={() => onMonthChange(ym)}
                          style={{ cursor: "pointer" }}
                          title={t("summaryDrillDown")}
                          data-testid={`month-row-${ym}`}
                        >
                          <td className="font-medium">
                            {formatYearMonthLabel(row, locale)}
                          </td>
                          <td className="num font-medium" style={{ textAlign: "right" }}>
                            {row.total_days}
                          </td>
                          <td className="num font-medium" style={{ textAlign: "right" }}>
                            {formatEUR(row.total_cost)}
                          </td>
                        </tr>
                        {/* Inline per-worker sub-rows. Hierarchy via indent
                            (pl-8) + smaller font (text-[13px]); the row text
                            inherits the table's normal ink color so it stays
                            readable on every theme + alt-row background.
                            (`var(--muted)` was too low-contrast inside table
                            rows even when fine for card subtitles.) */}
                        {row.workers.map((w) => (
                          <tr
                            key={`${ym}-${w.worker_id}`}
                            data-testid={`worker-subrow-${ym}-${w.worker_id}`}
                          >
                            <td className="text-[13px] pl-8">
                              {w.worker_name}
                            </td>
                            <td
                              className="num text-[13px]"
                              style={{ textAlign: "right" }}
                            >
                              {w.days_worked}
                            </td>
                            <td
                              className="num text-[13px]"
                              style={{ textAlign: "right" }}
                            >
                              {formatEUR(w.total_cost)}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--paper-2)" }}>
                    <td className="font-medium">{t("grandTotal")}</td>
                    <td className="num font-medium" style={{ textAlign: "right" }}>
                      {totalDays}
                    </td>
                    <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                      {formatEUR(totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        ) : !summary || summary.rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noEntries")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>{t("workerName")}</th>
                  <th>{t("role")}</th>
                  <th style={{ textAlign: "right" }}>{t("daysWorked")}</th>
                  <th style={{ textAlign: "right" }}>{t("avgCostPerDay")}</th>
                  <th style={{ textAlign: "right" }}>{t("totalCost")}</th>
                  <th style={{ textAlign: "right" }}>{t("supplement.bonusDays")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map((row) => {
                  const dailyRate = row.days_worked > 0 ? row.total_cost / row.days_worked : 0;
                  const initials = row.worker_name
                    .split(" ")
                    .map((p) => p.charAt(0))
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <tr key={row.worker_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar">{initials}</div>
                          <span>{row.worker_name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)" }}>—</td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {row.days_worked}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {formatEUR(dailyRate)}
                      </td>
                      <td className="num font-medium" style={{ textAlign: "right" }}>
                        {formatEUR(row.total_cost)}
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>
                        {row.banked_hours > 0 ? (
                          <div className="flex flex-col items-end">
                            <span>{row.bonus_full_days}F + {row.bonus_half_days}H</span>
                            <span className="text-xs text-muted-foreground">
                              {row.banked_hours}h · {formatEUR(row.bonus_cost)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--paper-2)" }}>
                  <td colSpan={2} className="font-medium">
                    {t("grandTotal")}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {summary.total_days}
                  </td>
                  <td></td>
                  <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                    {formatEUR(summary.total_cost)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                    {totalBonusCost > 0 ? formatEUR(totalBonusCost) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      <LaborExportDialog
        projectId={projectId}
        open={exportOpen}
        onOpenChange={setExportOpen}
      />
    </div>
  );
}
