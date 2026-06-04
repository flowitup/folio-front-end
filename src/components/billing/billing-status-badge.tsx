/**
 * BillingStatusBadge — maps BillingDocumentStatus to a Folio "stamp" pill.
 *
 * Uses the design-system stamp primitive (globals.css) rather than ad-hoc
 * colour utilities, so status pills stay visually consistent with the rest
 * of the app (uppercase, hairline border, paper-toned tints).
 *
 * Semantic mapping:
 *   sent     → accent   (in-flight, terracotta)
 *   accepted → positive (green)
 *   paid     → positive (green)
 *   rejected → negative (red)
 *   overdue  → negative (red)
 *   expired  → warning  (amber)
 *   draft    → neutral  (base stamp)
 *   cancelled→ neutral  (base stamp)
 */

import type { BillingDocumentStatus } from "@/types/billing";

interface BillingStatusBadgeProps {
  status: BillingDocumentStatus;
  label: string;
}

const STATUS_STAMP: Record<BillingDocumentStatus, string> = {
  draft: "",
  sent: "accent",
  accepted: "positive",
  rejected: "negative",
  expired: "warning",
  paid: "positive",
  overdue: "negative",
  cancelled: "",
};

export function BillingStatusBadge({ status, label }: BillingStatusBadgeProps) {
  const variant = STATUS_STAMP[status];
  return <span className={variant ? `stamp ${variant}` : "stamp"}>{label}</span>;
}
