"use client";

/**
 * useLaborPaymentsData — data orchestration for the Payments tab: month
 * state + default-month pick, the three fetches per month switch (owed,
 * paid, this-month unassigned), the month-independent "no month" bucket,
 * and the quick-assign mutation handlers. Split out of labor-payments-tab.tsx
 * so that component stays presentational (CLAUDE.md's 200-line guidance).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/**
 * @param sharedPaymentsSummary Pass the parent's already-loaded payments
 *   summary (labor/page.tsx lifts this fetch so the Summary tab's Paid
 *   column and this tab don't each fetch it independently) plus its reload
 *   function. Omit both for standalone/self-contained usage (this hook then
 *   fetches its own copy, matching the original behavior).
 */
export function useLaborPaymentsData(
  projectId: string,
  sharedPaymentsSummary?: LaborPaymentsSummaryResponse | null,
  reloadSharedPaymentsSummary?: () => Promise<LaborPaymentsSummaryResponse>,
) {
  const t = useTranslations("labor.payments");
  // Both must be provided together — a caller that shares the summary value
  // but forgets the reload function (or vice versa) falls back to the
  // self-contained fetch rather than crashing on a missing reload call.
  const isShared = sharedPaymentsSummary !== undefined && reloadSharedPaymentsSummary !== undefined;

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
  // Own fetch/state — only used when the caller doesn't share one (see
  // `isShared` above).
  const [ownPaymentsSummary, setOwnPaymentsSummary] = useState<LaborPaymentsSummaryResponse | null>(null);
  const paymentsSummary = isShared ? sharedPaymentsSummary ?? null : ownPaymentsSummary;
  const [unassignedInvoices, setUnassignedInvoices] = useState<Invoice[]>([]);
  const [noMonthInvoices, setNoMonthInvoices] = useState<Invoice[]>([]);
  const [noMonthLoading, setNoMonthLoading] = useState(false);

  const [reloadSignal, setReloadSignal] = useState(0);
  const bump = () => setReloadSignal((v) => v + 1);

  const loadPaymentsSummary = useCallback(async () => {
    if (isShared) return reloadSharedPaymentsSummary!();
    const data = await fetchLaborPaymentsSummary(projectId);
    setOwnPaymentsSummary(data);
    return data;
  }, [projectId, isShared, reloadSharedPaymentsSummary]);

  // Captures the payments summary available at mount, for the one-time
  // default-month pick below — read via ref (not a dependency) so a later
  // payments update (e.g. after recording a payment) doesn't re-run that
  // effect and silently reset the user's selected month.
  const mountPaymentsSummaryRef = useRef(paymentsSummary);
  mountPaymentsSummaryRef.current = paymentsSummary;

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
  // summary + the month-independent no-month bucket, in parallel. When the
  // payments summary is shared from a parent, reuse the mount-time value
  // instead of re-fetching (avoids a redundant call to the same endpoint the
  // parent already resolved before this tab could even mount).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [monthly, payments] = await Promise.all([
          fetchLaborMonthlySummary(projectId),
          isShared ? Promise.resolve(mountPaymentsSummaryRef.current) : loadPaymentsSummary(),
        ]);
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
    // `isShared` (and the mount-time ref it gates) is intentionally excluded:
    // this effect picks the default month exactly once at mount from
    // whatever payments summary was available then. Including it would
    // re-run the pick — and refetch the monthly rollup — on every later
    // payments update, silently overriding the user's selected month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
