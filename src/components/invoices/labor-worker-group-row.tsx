"use client";

/**
 * LaborWorkerGroupRow — one worker's collapsed header + expanded history in
 * `labor-invoices-by-worker.tsx`. Two layouts share the same data: a compact
 * inline row for `variant="desktop"` and a stacked folio-card for
 * `variant="mobile"` (the "lighter accordion" the phase-09 spec calls for).
 */

import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatEUR, formatMonthYear } from "@/lib/utils/formatters";
import { personColor, personInitials } from "@/lib/utils/person-color";
import { LaborWorkerGroupHistory } from "@/components/invoices/labor-worker-group-history";
import type { WorkerInvoiceGroup } from "@/lib/invoices/group-labor-invoices-by-worker";
import type { Worker } from "@/types/labor";

export interface LaborWorkerGroupRowProps {
  group: WorkerInvoiceGroup;
  unassignedLabel: string;
  variant: "desktop" | "mobile";
  expanded: boolean;
  onToggle: () => void;
  projectId: string;
  canManage: boolean;
  workers: Worker[];
  companyName: string | null;
  selectedInvoiceId: string | null;
  onToggleInvoice: (id: string) => void;
  onCloseInvoice: () => void;
  onMutated: () => void;
  onAssignWorker: (invoiceId: string, workerId: string) => void;
  /** Worker has logged attendance in the current calendar month — highlights who is actually on site right now. */
  activeThisMonth?: boolean;
}

export function LaborWorkerGroupRow(props: LaborWorkerGroupRowProps) {
  const { group, unassignedLabel, variant, expanded, onToggle } = props;
  const t = useTranslations("invoices");
  const tByWorker = useTranslations("invoices.byWorker");
  const locale = useLocale();

  const isUnassigned = group.workerId === null;
  const displayName = isUnassigned ? unassignedLabel : group.displayName ?? "";
  const lastPaymentLabel = group.lastPaymentValue ? formatMonthYear(group.lastPaymentValue, locale) : "—";
  const testKey = group.workerId ?? "unassigned";
  const testIdSuffix = `${variant}-${testKey}`;

  const avatar = (
    <span
      className="avatar"
      style={isUnassigned ? undefined : { backgroundColor: personColor(group.workerId) }}
      aria-hidden="true"
    >
      {isUnassigned ? "?" : personInitials(displayName)}
    </span>
  );

  const chevron = expanded ? (
    <ChevronDown size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
  ) : (
    <ChevronRight size={14} style={{ color: "var(--muted)" }} aria-hidden="true" />
  );

  const activeStamp = props.activeThisMonth ? (
    <span className="stamp positive" data-testid={`labor-by-worker-active-${testIdSuffix}`}>
      {tByWorker("activeThisMonth")}
    </span>
  ) : null;

  const countStamp = (
    <span className="stamp num" data-testid={`labor-by-worker-count-${testIdSuffix}`}>
      {t("invoiceCount", { n: group.invoiceCount })}
    </span>
  );

  const lastPaymentStamp = (
    <span
      className="stamp num"
      title={tByWorker("lastPayment")}
      data-testid={`labor-by-worker-last-payment-${testIdSuffix}`}
    >
      {lastPaymentLabel}
    </span>
  );

  const totalPaidValue = (
    <span
      className="num font-medium text-[13.5px]"
      title={tByWorker("totalPaid")}
      data-testid={`labor-by-worker-total-${testIdSuffix}`}
    >
      {formatEUR(group.totalPaid)}
    </span>
  );

  const header =
    variant === "desktop" ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
        // Whole-row tint (not just the chip) so currently-active workers pop
        // out while scanning the list.
        style={props.activeThisMonth ? { background: "var(--positive-tint)" } : undefined}
      >
        {chevron}
        {avatar}
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{displayName}</span>
        {activeStamp}
        {countStamp}
        {lastPaymentStamp}
        {totalPaidValue}
      </button>
    ) : (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="folio-card flex w-full flex-col gap-2 p-4 text-left"
        style={props.activeThisMonth ? { background: "var(--positive-tint)" } : undefined}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            {chevron}
            {avatar}
            <span className="min-w-0 truncate text-[13.5px] font-medium">{displayName}</span>
          </span>
          {totalPaidValue}
        </span>
        <span className="flex items-center gap-1.5">
          {activeStamp}
          {countStamp}
          {lastPaymentStamp}
        </span>
      </button>
    );

  return (
    <div data-testid={`labor-by-worker-group-${testIdSuffix}`}>
      {header}
      {expanded && (
        <LaborWorkerGroupHistory
          invoices={group.invoices}
          variant={variant}
          projectId={props.projectId}
          canManage={props.canManage}
          isUnassignedGroup={isUnassigned}
          workers={props.workers}
          companyName={props.companyName}
          selectedInvoiceId={props.selectedInvoiceId}
          onToggleInvoice={props.onToggleInvoice}
          onCloseInvoice={props.onCloseInvoice}
          onMutated={props.onMutated}
          onAssignWorker={props.onAssignWorker}
        />
      )}
    </div>
  );
}
