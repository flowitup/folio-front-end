"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LaborSummaryResponse } from "@/types/labor";
import { formatEUR } from "@/lib/api/labor";
import { LaborExportDialog } from "@/components/labor/labor-export-dialog";

interface LaborSummaryProps {
  projectId: string;
  summary: LaborSummaryResponse | null;
  isLoading: boolean;
  month: string;
  onMonthChange: (value: string) => void;
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

export function LaborSummary({ projectId, summary, isLoading, month, onMonthChange }: LaborSummaryProps) {
  const t = useTranslations("labor");
  const locale = useLocale();
  const [exportOpen, setExportOpen] = useState(false);

  // month === "" → unbounded "all history" summary. Switch labels + headers
  // to a localized "All history" string and hide the Clear button.
  const isAllHistory = month === "";
  const periodLabel = isAllHistory
    ? t("filterMonthAll")
    : formatMonthLabel(month, locale);

  const totalCost = summary?.total_cost ?? 0;
  const totalDays = summary?.total_days ?? 0;
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

      {/* Monthly summary table */}
      <div className="folio-card overflow-hidden">
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center gap-3">
            <h3 className="font-display text-[18px] font-medium tracking-tight">
              {isAllHistory
                ? t("summaryAllHistoryTitle")
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
            {workerCount > 0 && (
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

        {!summary || summary.rows.length === 0 ? (
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
