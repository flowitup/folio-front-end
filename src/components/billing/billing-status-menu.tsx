"use client";

/**
 * BillingStatusMenu — status transition menu for billing documents.
 *
 * Mirrors the server-side transition matrix exactly:
 *   Devis:   draft→sent, sent→accepted|rejected|expired, accepted↔sent, rejected→draft;
 *            a devis left in a facture status by an old import (paid, overdue,
 *            cancelled) can be put back to draft|sent|accepted|rejected
 *   Facture: draft→sent, sent→paid|overdue|cancelled, overdue→paid, paid→cancelled
 *
 * Transitions with a side effect or no way back (paid, cancelled, expired,
 * rejected) ask for confirmation first.
 *
 * Terminal states (no outbound transitions) render the button disabled, and so
 * does a devis converted to a live facture (the API refuses any change to it).
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { billingStatusLabel } from "@/lib/billing/status-label";
import { updateBillingDocumentStatusAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { isDevisLockedByFacture } from "@/lib/billing/devis-lock";
import { useBillingErrorMessage } from "@/components/billing/use-billing-error-message";
import type { BillingDocument, BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";

// ---------------------------------------------------------------------------
// Transition matrix — references translation keys in billing.{kind}.transitions
// ---------------------------------------------------------------------------

type Transition = { to: BillingDocumentStatus; labelKey: string };

const DEVIS_REPAIR: Transition[] = [
  { to: "draft",    labelKey: "reopen" },
  { to: "sent",     labelKey: "markAsSent" },
  { to: "accepted", labelKey: "markAsAccepted" },
  { to: "rejected", labelKey: "markAsRejected" },
];

/** Targets that need a confirmation: a side effect or no easy way back. */
const CONFIRM_TARGETS: ReadonlySet<BillingDocumentStatus> = new Set<BillingDocumentStatus>([
  "paid",
  "cancelled",
  "expired",
  "rejected",
]);

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
  // Not devis statuses: only reachable through an old import. The API lets
  // such a devis go back to a real devis status (status.py _DEVIS_REPAIR).
  paid:      DEVIS_REPAIR,
  overdue:   DEVIS_REPAIR,
  cancelled: DEVIS_REPAIR,
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
  const tBilling = useTranslations("billing");
  const tConfirm = useTranslations("billing.form.confirmStatus");
  const tDevisTrans = useTranslations("billing.devis.transitions");
  const tFactureTrans = useTranslations("billing.facture.transitions");
  const tActions = useTranslations("billing.form.actions");
  const tErrors = useTranslations("billing.form.errors");
  const tToast = useTranslations("billing.form.toast");
  const errorMessage = useBillingErrorMessage();

  const [isUpdating, setIsUpdating] = useState(false);
  // Transition waiting for the user's confirmation.
  const [pending, setPending] = useState<Transition | null>(null);
  // Double-submit guard: synchronous check before React commit
  const updatingRef = useRef(false);

  // Until its facture is cancelled, a converted devis has no transition to offer.
  const transitions = isDevisLockedByFacture(document)
    ? []
    : getTransitions(document.kind, document.status);
  const isTerminal = transitions.length === 0;

  /** Locale-aware status label for the current document's kind. */
  function statusLabel(status: BillingDocumentStatus): string {
    return billingStatusLabel(tBilling, document.kind, status);
  }

  /** What confirming this transition does, for the dialog. */
  function confirmDescription(to: BillingDocumentStatus): string {
    if (document.kind === "facture" && to === "paid") return tConfirm("paid");
    if (document.kind === "facture" && to === "cancelled") return tConfirm("factureCancelled");
    if (document.kind === "devis" && to === "expired") return tConfirm("devisExpired");
    return tConfirm("devisRejected");
  }

  function requestTransition(transition: Transition) {
    if (CONFIRM_TARGETS.has(transition.to)) {
      setPending(transition);
      return;
    }
    void handleTransition(transition.to);
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
        if (result.error.code === "devis_locked") {
          toast.error(tErrors("devisLocked"));
        } else if (result.error.code === "conflict") {
          toast.error(tErrors("invalidTransition"));
        } else {
          toast.error(errorMessage(result.error, tErrors("statusUpdateFailed")));
        }
        return;
      }
      toast.success(tToast("statusUpdated", { status: statusLabel(to) }));
      onStatusChanged(result.data);
    } catch {
      toast.error(tErrors("statusUpdateFailed"));
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
                onClick={() => requestTransition(t)}
              >
                {transitionLabel(document.kind, t.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending ? tConfirm("title", { status: statusLabel(pending.to) }) : null}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? confirmDescription(pending.to) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tConfirm("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = pending;
                setPending(null);
                if (target) void handleTransition(target.to);
              }}
            >
              {pending ? transitionLabel(document.kind, pending.labelKey) : tConfirm("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
