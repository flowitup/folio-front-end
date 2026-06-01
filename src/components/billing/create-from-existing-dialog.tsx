"use client";

/**
 * CreateFromExistingDialog — pick an existing billing document to clone from.
 *
 * Behaviour:
 *   1. Loads a list of recent billing documents (both kinds, up to 50).
 *   2. User picks one → dialog closes → navigates to
 *      /billing/<kind>/new?from=<id>   (kind = source doc kind by default).
 *   3. Optional kind toggle: user can switch the target kind before navigating.
 *      Shows a warning when switching across kinds (lifecycle resets).
 *
 * State: plain useState, no form library.
 * Data: fetched client-side via fetch() to the server action (not SSR —
 *       dialog is opened on demand; acceptable latency).
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { listBillingDocumentsAction } from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { BillingDocument, BillingDocumentKind, BillingDocumentStatus } from "@/types/billing";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { formatDate } from "@/lib/utils/formatters";

function formatTTC(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateFromExistingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The default target kind for the new document. */
  kind: BillingDocumentKind;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateFromExistingDialog({
  open,
  onOpenChange,
  kind,
}: CreateFromExistingDialogProps) {
  const router = useRouter();
  const locale = useLocale();
  const tDevisStatus = useTranslations("billing.devis.status");
  const tFactureStatus = useTranslations("billing.facture.status");
  const tActions = useTranslations("billing.form.actions");

  /** Locale-aware status label — devis-specific statuses take priority; rest fall back to facture. */
  function statusLabel(status: BillingDocumentStatus): string {
    const devisStatuses = new Set<BillingDocumentStatus>(["draft", "sent", "accepted", "rejected", "expired"]);
    const factureOnlyStatuses = new Set<BillingDocumentStatus>(["paid", "overdue", "cancelled"]);
    if (devisStatuses.has(status)) {
      return tDevisStatus(status as "draft" | "sent" | "accepted" | "rejected" | "expired");
    }
    if (factureOnlyStatuses.has(status)) {
      return tFactureStatus(status as "paid" | "overdue" | "cancelled");
    }
    return status;
  }

  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetKind, setTargetKind] = useState<BillingDocumentKind>(kind);

  // Reset when dialog re-opens
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setTargetKind(kind);
      setLoadError(null);
      loadDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadDocuments() {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Fetch both kinds via two parallel server action calls, merge, sort by date desc.
      const [devisResult, factureResult] = await Promise.all([
        listBillingDocumentsAction("devis", 25),
        listBillingDocumentsAction("facture", 25),
      ]);
      const combined: BillingDocument[] = [];
      if (devisResult.ok) combined.push(...devisResult.data.items);
      if (factureResult.ok) combined.push(...factureResult.data.items);
      // Both failed → surface error
      if (!devisResult.ok && !factureResult.ok) {
        setLoadError("Could not load documents. The billing API may not be available yet.");
        setDocuments([]);
        return;
      }
      combined.sort(
        (a, b) =>
          new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime()
      );
      setDocuments(combined.slice(0, 50));
    } catch {
      setLoadError("Failed to load existing documents.");
      toast.error("Failed to load existing documents.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleConfirm() {
    if (!selectedId) return;
    onOpenChange(false);
    router.push(`/${locale}/billing/${kindToSegment(targetKind)}/new?from=${selectedId}`);
  }

  const selectedDoc = documents.find((d) => d.id === selectedId);
  const crossKind = selectedDoc && selectedDoc.kind !== targetKind;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tActions("cloneSelected")}</DialogTitle>
          <DialogDescription>
            Select a document to use as the starting point for your new{" "}
            <strong>{targetKind}</strong>. Items, recipient, notes and terms will
            be copied; dates and number will be reset.
          </DialogDescription>
        </DialogHeader>

        {/* Target kind override */}
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            Create as:
          </span>
          <Select
            value={targetKind}
            onValueChange={(v) => setTargetKind(v as BillingDocumentKind)}
          >
            <SelectTrigger className="h-7 w-32 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="devis">Devis</SelectItem>
              <SelectItem value="facture">Facture</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {crossKind && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Switching kinds resets the document lifecycle. The cloned{" "}
              {targetKind} will start as <strong>Draft</strong>.
            </span>
          </div>
        )}

        {/* Document list */}
        <div className="max-h-80 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted)" }} />
            </div>
          ) : loadError ? (
            <div className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              {loadError}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <FileText size={20} style={{ color: "var(--muted)" }} />
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                No existing documents found.
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleSelect(doc.id)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--paper-2)] ${
                    selectedId === doc.id ? "bg-[var(--paper-2)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
                          selectedId === doc.id
                            ? "border-[var(--ink)] bg-[var(--ink)]"
                            : "border-[var(--muted)] bg-transparent"
                        }`}
                      />
                      <div>
                        <p className="text-[13px] font-medium">{doc.document_number}</p>
                        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                          {doc.recipient_name} · {formatDate(doc.issue_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num text-[12px] font-medium">
                        {formatTTC(doc.total_ttc)}
                      </span>
                      <BillingStatusBadge
                        status={doc.status}
                        label={statusLabel(doc.status)}
                      />
                      <span
                        className="text-[11px] uppercase tracking-wide"
                        style={{ color: "var(--muted)" }}
                      >
                        {doc.kind}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tActions("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            {tActions("cloneSelected")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
