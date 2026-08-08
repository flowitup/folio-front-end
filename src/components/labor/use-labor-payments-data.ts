"use client";

/**
 * useLaborPaymentsData — data orchestration for the Payments tab: month
 * state + default-month pick, the three fetches per month switch (owed,
 * paid, this-month unassigned), the month-independent "no month" bucket,
 * and the quick-assign mutation handlers. Split out of labor-payments-tab.tsx
 * so that component stays presentational (CLAUDE.md's 200-line guidance).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { fetchLaborSummary, fetchLaborMonthlySummary, fetchLaborPaymentsSummary } from "@/lib/api/labor";
import { fetchInvoicesWithMeta, updateInvoice } from "@/lib/api/invoice-api";
import type { LaborSummaryResponse, LaborPaymentsSummaryResponse } from "@/types/labor";
import type { Invoice } from "@/types/invoice";
import {
  mergeWorkerPaymentRows,
  findMonthBucket,
  pickDefaultMonth,
  monthToDateRange,
} from "@/components/labor/labor-payments-tab-state";

export function useLaborPaymentsData(projectId: string) {
  const t = useTranslations("labor.payments");

  const [month, setMonth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  // Starts true (not false): the initial-load effect sets `month` and flips
  // `isLoading` false in the same state batch, so the very first render with
  // a resolved month happens BEFORE the per-month effect below has had a
  // chance to run (effects fire post-commit). Without this, that one frame
  // would merge `paymentsSummary` (already loaded) with a still-null
  // `laborSummary`, flashing a wrong "paid-only, owed=0" row.
  const [isMonthLoading, setIsMonthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [laborSummary, setLaborSummary] = useState<LaborSummaryResponse | null>(null);
  const [paymentsSummary, setPaymentsSummary] = useState<LaborPaymentsSummaryResponse | null>(null);
  const [unassignedInvoices, setUnassignedInvoices] = useState<Invoice[]>([]);
  const [noMonthInvoices, setNoMonthInvoices] = useState<Invoice[]>([]);
  const [noMonthLoading, setNoMonthLoading] = useState(false);

  const [reloadSignal, setReloadSignal] = useState(0);
  const bump = () => setReloadSignal((v) => v + 1);

  const loadPaymentsSummary = useCallback(async () => {
    const data = await fetchLaborPaymentsSummary(projectId);
    setPaymentsSummary(data);
    return data;
  }, [projectId]);

  const loadNoMonthInvoices = useCallback(async () => {
    setNoMonthLoading(true);
    try {
      const res = await fetchInvoicesWithMeta(projectId, "labor");
      setNoMonthInvoices(res.invoices.filter((inv) => !inv.service_month));
    } catch {
      setNoMonthInvoices([]);
    } finally {
      setNoMonthLoading(false);
    }
  }, [projectId]);

  const loadMonthData = useCallback(
    async (m: string) => {
      const range = monthToDateRange(m);
      const [summary, unassignedRes] = await Promise.all([
        range ? fetchLaborSummary(projectId, range) : Promise.resolve(null),
        fetchInvoicesWithMeta(projectId, "labor", undefined, `${m}-01`),
      ]);
      setLaborSummary(summary);
      setUnassignedInvoices(unassignedRes.invoices.filter((inv) => !inv.worker_id));
    },
    [projectId],
  );

  // Initial load: monthly-entries rollup (for default-month calc) + payments
  // summary + the month-independent no-month bucket, in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [monthly, payments] = await Promise.all([fetchLaborMonthlySummary(projectId), loadPaymentsSummary()]);
        if (!cancelled) setMonth(pickDefaultMonth(monthly, payments));
      } catch {
        if (!cancelled) setError(t("loadFailed"));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    loadNoMonthInvoices();
    return () => {
      cancelled = true;
    };
  }, [projectId, loadPaymentsSummary, loadNoMonthInvoices, t]);

  // Refetch owed + unassigned whenever the viewed month changes.
  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    setIsMonthLoading(true);
    loadMonthData(month)
      .catch(() => {
        if (!cancelled) setError(t("loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setIsMonthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, loadMonthData, t]);

  const bucket = useMemo(() => findMonthBucket(paymentsSummary, month), [paymentsSummary, month]);
  const rows = useMemo(() => mergeWorkerPaymentRows(laborSummary, bucket), [laborSummary, bucket]);
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          days: acc.days + r.days_worked,
          owed: acc.owed + r.owed,
          paid: acc.paid + r.paid,
          balance: acc.balance + r.balance,
        }),
        { days: 0, owed: 0, paid: 0, balance: 0 },
      ),
    [rows],
  );

  async function handleAssignWorker(invoiceId: string, workerId: string, includeMonth: boolean) {
    try {
      await updateInvoice(
        projectId,
        invoiceId,
        includeMonth ? { worker_id: workerId, service_month: `${month}-01` } : { worker_id: workerId },
      );
      toast.success(t("assignedToast"));
      bump();
      await Promise.all([loadMonthData(month), loadNoMonthInvoices(), loadPaymentsSummary()]);
    } catch {
      toast.error(t("assignFailed"));
    }
  }

  async function handleAssignMonth(invoiceId: string) {
    try {
      await updateInvoice(projectId, invoiceId, { service_month: `${month}-01` });
      toast.success(t("assignedToast"));
      bump();
      await Promise.all([loadMonthData(month), loadNoMonthInvoices(), loadPaymentsSummary()]);
    } catch {
      toast.error(t("assignFailed"));
    }
  }

  async function handleRecordSaved() {
    bump();
    await loadPaymentsSummary();
  }

  return {
    month,
    setMonth,
    isLoading,
    isMonthLoading,
    error,
    rows,
    totals,
    unassignedInvoices,
    noMonthInvoices,
    noMonthLoading,
    reloadSignal,
    handleAssignWorker,
    handleAssignMonth,
    handleRecordSaved,
  };
}
