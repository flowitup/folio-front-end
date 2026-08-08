"use client";

/**
 * LaborPaymentRow — one worker's owed/paid/balance row in the Payments tab
 * table, with an expand toggle that lazy-loads that worker+month's labor
 * invoices (number, date, amount, payment method, link into Expenses).
 *
 * Rendered twice by the container (desktop `<tr>` pair inside a `<table>`,
 * mobile `<div>` card) via the `variant` prop — the CSS that hides one or
 * the other still puts both in the DOM, so tests must scope queries with
 * `within(getByTestId(...-desktop))` / `(...-mobile)`.
 */

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEUR } from "@/lib/api/labor";
import { formatDate } from "@/lib/utils/formatters";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { Invoice } from "@/types/invoice";
import type { WorkerPaymentRow } from "@/components/labor/labor-payments-tab-state";

const STATUS_STAMP_CLASS: Record<WorkerPaymentRow["status"], string> = {
  unpaid: "stamp negative",
  partial: "stamp warning",
  settled: "stamp positive",
  overpaid: "stamp accent",
};

function formatDays(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export interface LaborPaymentRowProps {
  row: WorkerPaymentRow;
  projectId: string;
  /** Viewed month, "YYYY-MM". */
  month: string;
  canManage: boolean;
  /** Bumped by the container after a mutation — refetches the expanded
   *  invoice list so a just-recorded payment shows up without a re-toggle. */
  reloadSignal: number;
  onRecordPayment: () => void;
  variant: "desktop" | "mobile";
}

export function LaborPaymentRow({
  row,
  projectId,
  month,
  canManage,
  reloadSignal,
  onRecordPayment,
  variant,
}: LaborPaymentRowProps) {
  const t = useTranslations("labor.payments");
  const tLabor = useTranslations("labor");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    async function load() {
      if (!cancelled) setLoadingInvoices(true);
      try {
        const res = await fetchInvoicesWithMeta(projectId, "labor", undefined, `${month}-01`, row.worker_id);
        if (!cancelled) setInvoices(res.invoices);
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [expanded, projectId, month, row.worker_id, reloadSignal]);

  const statusLabel = t(`status.${row.status}`);
  const testIdSuffix = `${variant}-${row.worker_id}`;

  const invoiceList = loadingInvoices ? (
    <div className="flex items-center justify-center py-4">
      <Loader2 size={16} className="animate-spin" style={{ color: "var(--muted)" }} />
    </div>
  ) : !invoices || invoices.length === 0 ? (
    <p className="px-1 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
      {t("emptyMonth")}
    </p>
  ) : (
    <ul className="space-y-1.5 py-2" data-testid={`labor-payment-invoices-${testIdSuffix}`}>
      {invoices.map((inv) => (
        <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
          <Link
            href={`/${locale}/projects/${projectId}/invoices?invoice=${inv.id}`}
            className="underline underline-offset-2"
            title={t("viewInExpenses")}
          >
            {inv.invoice_number}
          </Link>
          <span style={{ color: "var(--muted)" }}>{formatDate(inv.issue_date)}</span>
          <span>
            {inv.payment_method_label
              ? localizeMethodLabel(inv.payment_method_label, tBuiltins)
              : "—"}
          </span>
          <span className="num font-medium">{formatEUR(inv.total_amount)}</span>
        </li>
      ))}
    </ul>
  );

  const expandToggle = (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className="flex min-w-0 items-center gap-2 text-left"
      aria-expanded={expanded}
      aria-label={t(expanded ? "collapseInvoices" : "expandInvoices")}
    >
      <ChevronRight
        size={14}
        aria-hidden="true"
        style={{
          color: "var(--muted)",
          transform: `rotate(${expanded ? 90 : 0}deg)`,
          transition: "transform 160ms ease",
          flexShrink: 0,
        }}
      />
      <span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>
        {initials(row.worker_name)}
      </span>
      <span className="truncate">{row.worker_name}</span>
    </button>
  );

  const recordButton = canManage && (
    <Button type="button" size="sm" variant="outline" onClick={onRecordPayment}>
      {t("recordPayment")}
    </Button>
  );

  if (variant === "desktop") {
    return (
      <>
        <tr data-testid={`labor-payment-row-${testIdSuffix}`}>
          <td>{expandToggle}</td>
          <td className="num" style={{ textAlign: "right" }}>
            {formatDays(row.days_worked)}
          </td>
          <td className="num" style={{ textAlign: "right" }}>
            {formatEUR(row.owed)}
          </td>
          <td className="num" style={{ textAlign: "right" }}>
            {formatEUR(row.paid)}
          </td>
          <td className="num font-medium" style={{ textAlign: "right" }}>
            {formatEUR(row.balance)}
          </td>
          <td>
            <span className={STATUS_STAMP_CLASS[row.status]}>{statusLabel}</span>
          </td>
          <td style={{ textAlign: "right" }}>{recordButton}</td>
        </tr>
        {expanded && (
          <tr data-testid={`labor-payment-expand-${testIdSuffix}`}>
            <td colSpan={7} style={{ background: "rgba(0,0,0,.015)", padding: "0 20px" }}>
              {invoiceList}
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="folio-card space-y-2 p-4" data-testid={`labor-payment-row-${testIdSuffix}`}>
      <div className="flex items-center justify-between gap-2">
        {expandToggle}
        <span className={STATUS_STAMP_CLASS[row.status]}>{statusLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12.5px]">
        <div>
          <div style={{ color: "var(--muted)" }}>{tLabor("daysWorked")}</div>
          <div className="num font-medium">{formatDays(row.days_worked)}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)" }}>{t("owed")}</div>
          <div className="num font-medium">{formatEUR(row.owed)}</div>
        </div>
        <div>
          <div style={{ color: "var(--muted)" }}>{t("paid")}</div>
          <div className="num font-medium">{formatEUR(row.paid)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-[12.5px]">
          <span style={{ color: "var(--muted)" }}>{t("balance")}: </span>
          <span className="num font-medium">{formatEUR(row.balance)}</span>
        </div>
        {recordButton}
      </div>
      {expanded && invoiceList}
    </div>
  );
}
