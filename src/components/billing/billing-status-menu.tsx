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

import { useState } from "react";
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
// Transition matrix
// ---------------------------------------------------------------------------

type Transition = { to: BillingDocumentStatus; label: string };

const DEVIS_TRANSITIONS: Record<BillingDocumentStatus, Transition[]> = {
  draft:     [{ to: "sent",     label: "Mark as Sent" }],
  sent:      [
    { to: "accepted", label: "Mark as Accepted" },
    { to: "rejected", label: "Mark as Rejected" },
    { to: "expired",  label: "Mark as Expired" },
  ],
  accepted:  [{ to: "sent",    label: "Revert to Sent" }],
  rejected:  [{ to: "draft",   label: "Re-open (Draft)" }],
  expired:   [], // terminal
  paid:      [], // N/A for devis
  overdue:   [], // N/A for devis
  cancelled: [], // N/A for devis
};

const FACTURE_TRANSITIONS: Record<BillingDocumentStatus, Transition[]> = {
  draft:     [{ to: "sent",      label: "Mark as Sent" }],
  sent:      [
    { to: "paid",      label: "Mark as Paid" },
    { to: "overdue",   label: "Mark as Overdue" },
    { to: "cancelled", label: "Mark as Cancelled" },
  ],
  overdue:   [{ to: "paid",      label: "Mark as Paid" }],
  paid:      [{ to: "cancelled", label: "Mark as Cancelled (refund)" }],
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
// Status labels
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<BillingDocumentStatus, string> = {
  draft:     "Draft",
  sent:      "Sent",
  accepted:  "Accepted",
  rejected:  "Rejected",
  expired:   "Expired",
  paid:      "Paid",
  overdue:   "Overdue",
  cancelled: "Cancelled",
};

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
  const [isUpdating, setIsUpdating] = useState(false);

  const transitions = getTransitions(document.kind, document.status);
  const isTerminal = transitions.length === 0;

  async function handleTransition(to: BillingDocumentStatus) {
    setIsUpdating(true);
    try {
      const result = await updateBillingDocumentStatusAction(document.id, to);
      if (!result.ok) {
        if (result.error.code === "conflict") {
          toast.error(
            "This status transition is not allowed. The document may have been updated by another session."
          );
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success(`Status updated to ${STATUS_LABEL[to]}.`);
      onStatusChanged(result.data);
    } catch {
      toast.error("Failed to update status. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <BillingStatusBadge
        status={document.status}
        label={STATUS_LABEL[document.status]}
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
                  Change status
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
                {t.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
