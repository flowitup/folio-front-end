"use client";

/**
 * BillingStatusMenu — status transition menu for billing documents.
 *
 * Mirrors the server-side transition matrix exactly:
 *   Devis:   draft→sent, sent→accepted|rejected|expired, accepted↔sent, rejected→draft
 *   Facture: draft→sent, sent→paid|overdue|cancelled, overdue→paid, paid→cancelled
 *
 * Terminal states (no outbound transitions) render the button disabled.
 * On 409 (race / invalid transition from server) surfaces a toast error.
 */

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { updateBillingDocumentStatusAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { BillingDocument, BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";

// ---------------------------------------------------------------------------
// Transition matrix — references translation keys in billing.{kind}.transitions
// ---------------------------------------------------------------------------

type Transition = { to: BillingDocumentStatus; labelKey: string };

const DEVIS_TRANSITIONS: Record<BillingDocumentStatus, Transition[]> = {
  draft:     [{ to: "sent",     labelKey: "markAsSent" }],
  sent:      [
    { to: "accepted", labelKey: "markAsAccepted" },
    { to: "rejected", labelKey: "markAsRejected" },
    { to: "expired",  labelKey: "markAsExpired" },
  ],
  accepted:  [{ to: "sent",    labelKey: "revertToSent" }],
  rejected:  [{ to: "draft",   labelKey: "reopen" }],
  expired:   [], // terminal
  paid:      [], // N/A for devis
  overdue:   [], // N/A for devis
  cancelled: [], // N/A for devis
};

const FACTURE_TRANSITIONS: Record<BillingDocumentStatus, Transition[]> = {
  draft:     [{ to: "sent",      labelKey: "markAsSent" }],
  sent:      [
    { to: "paid",      labelKey: "markAsPaid" },
    { to: "overdue",   labelKey: "markAsOverdue" },
    { to: "cancelled", labelKey: "markAsCancelled" },
  ],
  overdue:   [{ to: "paid",      labelKey: "markAsPaid" }],
  paid:      [{ to: "cancelled", labelKey: "markAsCancelledRefund" }],
  cancelled: [], // terminal
  accepted:  [], // N/A for facture
  rejected:  [], // N/A for facture
  expired:   [], // N/A for facture
};

function getTransitions(
  kind: BillingDocumentKind,
  status: BillingDocumentStatus
): Transition[] {
  const matrix = kind === "devis" ? DEVIS_TRANSITIONS : FACTURE_TRANSITIONS;
  return matrix[status] ?? [];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BillingStatusMenuProps {
  document: BillingDocument;
  /** Called with the updated document on successful transition. */
  onStatusChanged: (updated: BillingDocument) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingStatusMenu({
  document,
  onStatusChanged,
}: BillingStatusMenuProps) {
  const tDevisStatus = useTranslations("billing.devis.status");
  const tFactureStatus = useTranslations("billing.facture.status");
  const tDevisTrans = useTranslations("billing.devis.transitions");
  const tFactureTrans = useTranslations("billing.facture.transitions");
  const tActions = useTranslations("billing.form.actions");
  const tErrors = useTranslations("billing.form.errors");

  const [isUpdating, setIsUpdating] = useState(false);
  // Double-submit guard: synchronous check before React commit
  const updatingRef = useRef(false);

  const transitions = getTransitions(document.kind, document.status);
  const isTerminal = transitions.length === 0;

  /** Locale-aware status label for the current document's kind. */
  function statusLabel(status: BillingDocumentStatus): string {
    if (document.kind === "devis") {
      // Devis statuses: draft, sent, accepted, rejected, expired
      if (status in { draft: 1, sent: 1, accepted: 1, rejected: 1, expired: 1 }) {
        return tDevisStatus(status as "draft" | "sent" | "accepted" | "rejected" | "expired");
      }
    } else {
      // Facture statuses: draft, sent, paid, overdue, cancelled
      if (status in { draft: 1, sent: 1, paid: 1, overdue: 1, cancelled: 1 }) {
        return tFactureStatus(status as "draft" | "sent" | "paid" | "overdue" | "cancelled");
      }
    }
    return status;
  }

  /** Locale-aware transition label. */
  function transitionLabel(kind: BillingDocumentKind, labelKey: string): string {
    const tTrans = kind === "devis" ? tDevisTrans : tFactureTrans;
    // labelKey is one of the keys in billing.{kind}.transitions
    return tTrans(labelKey as Parameters<typeof tDevisTrans>[0]);
  }

  async function handleTransition(to: BillingDocumentStatus) {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);
    try {
      const result = await updateBillingDocumentStatusAction(document.id, to);
      if (!result.ok) {
        if (result.error.code === "conflict") {
          toast.error(tErrors("invalidTransition"));
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success(`Status updated to ${statusLabel(to)}.`);
      onStatusChanged(result.data);
    } catch {
      toast.error("Failed to update status. Please try again.");
    } finally {
      setIsUpdating(false);
      updatingRef.current = false;
    }
  }

  return (
    <div className="flex items-center gap-2">
      <BillingStatusBadge
        status={document.status}
        label={statusLabel(document.status)}
      />

      {!isTerminal && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 px-2 text-[12px]"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <>
                  {tActions("changeStatus")}
                  <ChevronDown size={11} />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {transitions.map((t) => (
              <DropdownMenuItem
                key={t.to}
                onClick={() => handleTransition(t.to)}
              >
                {transitionLabel(document.kind, t.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
