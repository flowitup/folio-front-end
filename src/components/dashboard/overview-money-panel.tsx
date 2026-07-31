"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatEURWhole } from "@/lib/utils/formatters";
import {
  monthKeyToDate,
  type BudgetMetrics,
  type MonthDelta,
  type MonthlySpendPoint,
  type MoneyPurseView,
  type PendingRefunds,
} from "@/lib/dashboard/overview-metrics";

// Dark-panel-only tints — no light-mode equivalent CSS var, kept literal
// (design Canvas 3a "4b ink money panel").
const NEGATIVE_ON_DARK = "#e8a58a";
const POSITIVE_ON_DARK = "#a8c69a";
const REFUND_PILL_BG = "rgba(232,132,60,0.16)";
const REFUND_PILL_BORDER = "rgba(241,200,163,0.35)";
const REFUND_PILL_TEXT = "#f1c8a3";
const DIAL_TRACK = "rgba(245,241,234,0.16)";
const DIVIDER = "rgba(245,241,234,0.12)";
const TRACK_BG = "rgba(245,241,234,0.14)";

const DIAL_SIZE = 56;
const DIAL_RADIUS = 24;
const DIAL_STROKE = 7;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function PurseMiniDial({ percent, color }: { percent: number; color: string }) {
  const filled = (DIAL_CIRCUMFERENCE * Math.min(100, Math.max(0, percent))) / 100;
  return (
    <svg width={DIAL_SIZE} height={DIAL_SIZE} viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`} aria-hidden="true" className="flex-none">
      <circle cx={DIAL_SIZE / 2} cy={DIAL_SIZE / 2} r={DIAL_RADIUS} fill="none" stroke={DIAL_TRACK} strokeWidth={DIAL_STROKE} />
      <circle
        cx={DIAL_SIZE / 2}
        cy={DIAL_SIZE / 2}
        r={DIAL_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={DIAL_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${DIAL_CIRCUMFERENCE}`}
        transform={`rotate(-90 ${DIAL_SIZE / 2} ${DIAL_SIZE / 2})`}
      />
    </svg>
  );
}

export interface OverviewMoneyPanelProps {
  spentTotal: number;
  budgetMetrics: BudgetMetrics;
  monthlySeries: MonthlySpendPoint[];
  monthDelta: MonthDelta;
  pendingRefunds: PendingRefunds;
  purses: MoneyPurseView[];
}

/** Dark ink "ledger" card — headline credit remaining, this month's spend with
 * a 6-month sparkline, the credit progress bar, and the company/personal
 * purse mini-dials (design Canvas 3a, section "4b ink money panel"). */
export function OverviewMoneyPanel({
  spentTotal,
  budgetMetrics,
  monthlySeries,
  monthDelta,
  pendingRefunds,
  purses,
}: OverviewMoneyPanelProps) {
  const t = useTranslations("dashboard");
  const tInvoices = useTranslations("invoices");
  const tProjects = useTranslations("projects");
  const locale = useLocale();
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "short" });

  const sparkMax = Math.max(...monthlySeries.map((p) => p.total), 1);
  const sparkX = (i: number) => 4 + i * 30;
  const sparkY = (v: number) => 38 - (v / sparkMax) * 30;
  const sparkPts = monthlySeries.map((p, i) => ({ x: sparkX(i), y: sparkY(p.total) }));
  const lastIdx = sparkPts.length - 1;
  const sparkArea =
    sparkPts.length > 0
      ? `M${sparkPts[0].x},38 L${sparkPts.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" L")} L${sparkPts[lastIdx].x},38 Z`
      : "";
  const sparkLine = sparkPts.map((p) => `${p.x},${p.y.toFixed(1)}`).join(" ");

  const company = purses.find((p) => p.key === "company");
  const personal = purses.find((p) => p.key === "personal");

  const purseRow = (
    purse: MoneyPurseView | undefined,
    title: string,
    stamp: string,
    dialColor: string
  ) => {
    if (!purse) return null;
    const pct = purse.released > 0 ? (purse.spent / purse.released) * 100 : 0;
    const left = purse.released - purse.spent;
    return (
      <div className="flex items-center gap-4">
        <PurseMiniDial percent={pct} color={dialColor} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12.5px] font-semibold">{title}</span>
            <span className="text-[10.5px] uppercase tracking-[0.05em]" style={{ opacity: 0.55 }}>
              {stamp}
            </span>
          </div>
          <div className="num mt-1 text-[17px] font-medium" style={{ letterSpacing: "-.02em" }}>
            {formatEURWhole(left)}{" "}
            <span className="font-sans text-[11px]" style={{ opacity: 0.6 }}>
              {tInvoices("summary.left")}
            </span>
          </div>
          <div className="mt-0.5 text-[11px]" style={{ opacity: 0.62 }}>
            {tInvoices("summary.released")} <span className="num">{formatEURWhole(purse.released)}</span>
            {" · "}
            {tInvoices("summary.spent")} <span className="num">{formatEURWhole(purse.spent)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="rounded-[14px] p-6"
      style={{ background: "var(--ink)", color: "var(--paper)" }}
      data-testid="overview-money-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-wrap items-start gap-9">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ opacity: 0.6 }}>
              {tProjects("remaining")}
            </div>
            <div
              className="num mt-2 text-[34px] font-medium leading-none"
              style={{ letterSpacing: "-.02em", color: budgetMetrics.left < 0 ? NEGATIVE_ON_DARK : undefined }}
            >
              {formatEURWhole(budgetMetrics.left)}
            </div>
          </div>
          <div className="flex items-end gap-6" style={{ borderLeft: "1px solid rgba(245,241,234,0.14)", paddingLeft: 32 }}>
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-[0.1em]" style={{ opacity: 0.6 }}>
                {t("money.spentThisMonth")}
              </div>
              <div className="num mt-2.5 text-[24px] font-medium leading-none" style={{ letterSpacing: "-.02em" }}>
                {formatEURWhole(monthDelta.current.total)}
              </div>
              <div className="mt-1.5 text-[11px]" style={{ opacity: 0.62 }}>
                {monthDelta.deltaPct !== null && monthDelta.previous && (
                  <span style={{ color: monthDelta.deltaPct < 0 ? POSITIVE_ON_DARK : undefined }}>
                    {tInvoices("summary.vsMonth", {
                      delta: `${monthDelta.deltaPct > 0 ? "+" : ""}${monthDelta.deltaPct}%`,
                      month: monthFmt.format(monthKeyToDate(monthDelta.previous.key)),
                    })}
                    {" · "}
                  </span>
                )}
                {tInvoices("invoiceCount", { n: monthDelta.current.count })}
              </div>
            </div>
            {sparkPts.length > 0 && (
              <div>
                <svg width={158} height={40} viewBox="0 0 158 40" aria-hidden="true">
                  <path d={sparkArea} fill="rgba(232,132,60,0.14)" />
                  <polyline points={sparkLine} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {sparkPts.map((p, i) => (
                    <circle
                      key={monthlySeries[i].key}
                      cx={p.x}
                      cy={p.y.toFixed(1)}
                      r={i === lastIdx ? 3 : 2}
                      fill={i === lastIdx ? "var(--accent)" : "rgba(245,241,234,0.55)"}
                      stroke={i === lastIdx ? "var(--ink)" : undefined}
                      strokeWidth={i === lastIdx ? 1.5 : undefined}
                    />
                  ))}
                </svg>
                <div className="mt-0.5 flex justify-between text-[9.5px]" style={{ opacity: 0.5 }}>
                  <span>{monthFmt.format(monthKeyToDate(monthlySeries[0].key))}</span>
                  <span>{monthFmt.format(monthKeyToDate(monthlySeries[lastIdx].key))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {pendingRefunds.count > 0 && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.05em]"
            style={{ background: REFUND_PILL_BG, border: `1px solid ${REFUND_PILL_BORDER}`, color: REFUND_PILL_TEXT }}
          >
            {tInvoices("summary.pendingRefunds")} · {formatEURWhole(pendingRefunds.total)}
          </span>
        )}
      </div>

      <div className="mt-[18px]">
        <div className="relative h-[10px] overflow-hidden rounded-full" style={{ background: TRACK_BG }}>
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: "var(--accent)", width: `${budgetMetrics.pctClamped}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px]" style={{ opacity: 0.62 }}>
          <span>{formatEURWhole(0)}</span>
          <span>
            <span className="num">{t("money.pctSpent", { pct: budgetMetrics.pct, spent: formatEURWhole(spentTotal) })}</span>
          </span>
          <span>{formatEURWhole(budgetMetrics.denominator)}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-8 pt-5 sm:grid-cols-2" style={{ borderTop: `1px solid ${DIVIDER}` }}>
        {purseRow(
          company,
          tInvoices("summary.companyPurse"),
          tInvoices("invoiceCount", { n: company?.count ?? 0 }),
          "var(--paper)"
        )}
        {purseRow(
          personal,
          tInvoices("summary.personalPurse"),
          pendingRefunds.count > 0
            ? `${tInvoices("summary.refundableCount", { n: pendingRefunds.count })} · ${formatEURWhole(pendingRefunds.total)}`
            : tInvoices("invoiceCount", { n: personal?.count ?? 0 }),
          "var(--accent)"
        )}
      </div>
    </div>
  );
}
