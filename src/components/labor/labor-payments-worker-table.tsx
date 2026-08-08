"use client";

/**
 * LaborPaymentsWorkerTable — the Payments tab's main card: title + month
 * picker + header "record payment" button, and the per-worker owed/paid/
 * balance table (desktop) / stacked cards (mobile) with a footer totals row.
 * Split out of labor-payments-tab.tsx to keep that container focused on
 * data orchestration (CLAUDE.md's 200-line modularization guidance).
 */

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Calendar, ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/api/labor";
import { LaborPaymentRow } from "@/components/labor/labor-payment-row";
import type { WorkerPaymentRow } from "@/components/labor/labor-payments-tab-state";

export interface LaborPaymentsWorkerTableProps {
  projectId: string;
  /** Viewed month, "YYYY-MM". */
  month: string;
  /** Localized "July 2026"-style label for `month`. */
  periodLabel: string;
  onMonthChange: (value: string) => void;
  canManage: boolean;
  isLoading: boolean;
  rows: WorkerPaymentRow[];
  totals: { days: number; owed: number; paid: number; balance: number };
  reloadSignal: number;
  onOpenRecordDialog: () => void;
  onRecordPaymentForWorker: (workerId: string) => void;
}

export function LaborPaymentsWorkerTable({
  projectId,
  month,
  periodLabel,
  onMonthChange,
  canManage,
  isLoading,
  rows,
  totals,
  reloadSignal,
  onOpenRecordDialog,
  onRecordPaymentForWorker,
}: LaborPaymentsWorkerTableProps) {
  const t = useTranslations("labor.payments");
  const tLabor = useTranslations("labor");
  const monthInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="folio-card overflow-hidden">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: "var(--line)" }}
      >
        <h3 className="font-display text-[18px] font-medium tracking-tight">{t("tab")}</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="folio-month-picker"
              onClick={() => {
                const el = monthInputRef.current;
                if (!el) return;
                if (typeof el.showPicker === "function") el.showPicker();
                else el.focus();
              }}
              aria-label={tLabor("filterMonth")}
            >
              <Calendar size={14} aria-hidden="true" />
              <span className="num">{periodLabel}</span>
              <ChevronDown size={14} aria-hidden="true" style={{ color: "var(--muted)", marginLeft: 2 }} />
            </button>
            <input
              ref={monthInputRef}
              type="month"
              value={month}
              onChange={(e) => e.target.value && onMonthChange(e.target.value)}
              aria-hidden="true"
              tabIndex={-1}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, pointerEvents: "none" }}
            />
          </div>
          {canManage && (
            <Button type="button" size="sm" onClick={onOpenRecordDialog}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("recordPayment")}</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
          {t("emptyMonth")}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto lg:block" data-testid="labor-payments-desktop">
            <table className="ledger">
              <thead>
                <tr>
                  <th>{tLabor("workerName")}</th>
                  <th style={{ textAlign: "right" }}>{tLabor("daysWorked")}</th>
                  <th style={{ textAlign: "right" }}>{t("owed")}</th>
                  <th style={{ textAlign: "right" }}>{t("paid")}</th>
                  <th style={{ textAlign: "right" }}>{t("balance")}</th>
                  <th>{t("statusColumn")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <LaborPaymentRow
                    key={row.worker_id}
                    row={row}
                    projectId={projectId}
                    month={month}
                    canManage={canManage}
                    reloadSignal={reloadSignal}
                    onRecordPayment={() => onRecordPaymentForWorker(row.worker_id)}
                    variant="desktop"
                  />
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--paper-2)" }}>
                  <td className="font-medium">{tLabor("grandTotal")}</td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {totals.days}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {formatEUR(totals.owed)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right" }}>
                    {formatEUR(totals.paid)}
                  </td>
                  <td className="num font-medium" style={{ textAlign: "right", color: "var(--accent-ink)" }}>
                    {formatEUR(totals.balance)}
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 lg:hidden" data-testid="labor-payments-mobile">
            {rows.map((row) => (
              <LaborPaymentRow
                key={row.worker_id}
                row={row}
                projectId={projectId}
                month={month}
                canManage={canManage}
                reloadSignal={reloadSignal}
                onRecordPayment={() => onRecordPaymentForWorker(row.worker_id)}
                variant="mobile"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
