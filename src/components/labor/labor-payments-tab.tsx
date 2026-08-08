"use client";

/**
 * LaborPaymentsTab — the "Payments" tab of the Labor section: a
 * management home for labor payments (month picker, per-worker
 * owed/paid/balance table, record-payment dialog, invoice drill-down,
 * unassigned + no-month buckets with quick-assign).
 *
 * Self-contained: owns its own month state and data fetches (via
 * useLaborPaymentsData) so the tab only pays its fetch cost while active,
 * matching the sibling Summary/Attendance tabs' pattern in labor/page.tsx.
 * Kept presentational — data orchestration lives in the hook, the header +
 * table markup lives in LaborPaymentsWorkerTable (200-line guidance).
 */

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Worker, LaborPaymentsSummaryResponse } from "@/types/labor";
import { useLaborPaymentsData } from "@/components/labor/use-labor-payments-data";
import { LaborPaymentsWorkerTable } from "@/components/labor/labor-payments-worker-table";
import { UnassignedLaborInvoices } from "@/components/labor/unassigned-labor-invoices";
import { RecordLaborPaymentDialog } from "@/components/labor/record-labor-payment-dialog";

export interface LaborPaymentsTabProps {
  projectId: string;
  /** Gated on project:manage_invoices — same flag the Invoices page uses,
   *  since every mutation here (record payment, quick-assign) is an
   *  invoice write, not a labor-entry write. */
  canManage: boolean;
  workers: Worker[];
  /** The project's company id — enables the optional payment-method picker
   *  in the record dialog (methods are company-scoped). Null/omitted hides it. */
  companyId?: string | null;
  /** Share the payments-summary fetch with a parent (labor/page.tsx lifts
   *  it so the Summary tab's Paid column and this tab don't each fetch it
   *  independently). Omit both to keep this tab fully self-contained. */
  paymentsSummary?: LaborPaymentsSummaryResponse | null;
  onReloadPaymentsSummary?: () => Promise<LaborPaymentsSummaryResponse>;
}

function formatMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function LaborPaymentsTab({
  projectId,
  canManage,
  workers,
  companyId,
  paymentsSummary,
  onReloadPaymentsSummary,
}: LaborPaymentsTabProps) {
  const t = useTranslations("labor.payments");
  const tLabor = useTranslations("labor");
  const locale = useLocale();

  const {
    month,
    setMonth,
    isLoading,
    isMonthLoading,
    error,
    rows,
    totals,
    bucket,
    unassignedInvoices,
    noMonthInvoices,
    noMonthLoading,
    reloadSignal,
    handleAssignWorker,
    handleAssignMonth,
    handleRecordSaved,
  } = useLaborPaymentsData(projectId, paymentsSummary, onReloadPaymentsSummary);

  const [recordDialog, setRecordDialog] = useState<{ open: boolean; worker: Worker | null }>({
    open: false,
    worker: null,
  });

  if (isLoading) {
    return (
      <div className="folio-card flex items-center justify-center p-12">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
      </div>
    );
  }

  if (workers.length === 0) {
    return (
      <div className="folio-card px-5 py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
        {tLabor("noWorkers")}
      </div>
    );
  }

  const periodLabel = month ? formatMonthLabel(month, locale) : "";
  const monthAssignLabel = t("assignToMonth", { month: periodLabel });

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <LaborPaymentsWorkerTable
        projectId={projectId}
        month={month}
        periodLabel={periodLabel}
        onMonthChange={setMonth}
        canManage={canManage}
        isLoading={isMonthLoading}
        rows={rows}
        totals={totals}
        monthSplit={{ company: bucket?.company_paid ?? 0, personal: bucket?.personal_paid ?? 0 }}
        reloadSignal={reloadSignal}
        onOpenRecordDialog={() => setRecordDialog({ open: true, worker: null })}
        onRecordPaymentForWorker={(workerId) => {
          const w = workers.find((wk) => wk.id === workerId) ?? null;
          setRecordDialog({ open: true, worker: w });
        }}
      />

      <UnassignedLaborInvoices
        testId="labor-unassigned"
        title={t("unassignedTitle")}
        hint={unassignedInvoices.length > 0 ? t("unassignedHint", { n: unassignedInvoices.length }) : undefined}
        invoices={unassignedInvoices}
        workers={workers}
        canManage={canManage}
        isLoading={isMonthLoading}
        emptyMessage={t("emptyMonth")}
        onAssignWorker={(invoiceId, workerId) => handleAssignWorker(invoiceId, workerId, false)}
      />

      {(noMonthLoading || noMonthInvoices.length > 0) && (
        <UnassignedLaborInvoices
          testId="labor-no-month"
          title={t("noMonthTitle")}
          hint={noMonthInvoices.length > 0 ? t("invoiceCount", { n: noMonthInvoices.length }) : undefined}
          invoices={noMonthInvoices}
          workers={workers}
          canManage={canManage}
          isLoading={noMonthLoading}
          emptyMessage={t("emptyMonth")}
          assignMonthLabel={monthAssignLabel}
          onAssignWorker={(invoiceId, workerId) => handleAssignWorker(invoiceId, workerId, true)}
          onAssignMonth={handleAssignMonth}
        />
      )}

      <RecordLaborPaymentDialog
        projectId={projectId}
        open={recordDialog.open}
        onOpenChange={(open) => setRecordDialog((prev) => ({ ...prev, open }))}
        worker={recordDialog.worker}
        month={month}
        companyId={companyId}
        onSaved={handleRecordSaved}
      />
    </div>
  );
}
