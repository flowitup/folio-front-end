/**
 * BillingStatusBadge — maps BillingDocumentStatus to a coloured pill.
 *
 * Colour palette:
 *   Devis:   draft=slate, sent=blue, accepted=green, rejected=red, expired=amber
 *   Facture: draft=slate, sent=blue, paid=green, overdue=red, cancelled=zinc
 */

import type { BillingDocumentStatus } from "@/types/billing";

interface BillingStatusBadgeProps {
  status: BillingDocumentStatus;
  label: string;
}

const STATUS_CLASS: Record<BillingDocumentStatus, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  expired: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export function BillingStatusBadge({ status, label }: BillingStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${STATUS_CLASS[status]}`}
    >
      {label}
    </span>
  );
}
