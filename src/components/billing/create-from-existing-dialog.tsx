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

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { BillingDocument, BillingDocumentKind } from "@/types/billing";
import { billingStatusLabel } from "@/lib/billing/status-label";
import { kindToSegment } from "@/lib/billing/url-helpers";
import { formatDate } from "@/lib/utils/formatters";
import { toIsoDate } from "@/lib/billing/document-payload";

/** Documents of each kind fetched per page. */
const PAGE_SIZE = 25;

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
  const tActions = useTranslations("billing.form.actions");
  const tErrors = useTranslations("billing.form.errors");
  const tFromExisting = useTranslations("billing.form.fromExisting");
  const tKind = useTranslations("billing.templates.form");

  const tBilling = useTranslations("billing");

  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetKind, setTargetKind] = useState<BillingDocumentKind>(kind);
  // Search (number, recipient or project, server-side) and paging per kind:
  // every document the user can see can be found, not just the 25 latest.
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState({ devis: 0, facture: 0 });
  const [totals, setTotals] = useState({ devis: 0, facture: 0 });
  const requestId = useRef(0);

  // Reset when dialog re-opens
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setTargetKind(kind);
      setLoadError(null);
      setSearchText("");
      setSearch("");
      void loadDocuments("", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Debounced search: reload from the first page.
  useEffect(() => {
    if (!open) return;
    const next = searchText.trim();
    if (next === search) return;
    const id = setTimeout(() => {
      setSearch(next);
      void loadDocuments(next, false);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  /** Newest issue first, then the higher number (the API's own order). */
  function byIssueDate(a: BillingDocument, b: BillingDocument): number {
    const d = new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime();
    return d !== 0 ? d : b.document_number.localeCompare(a.document_number);
  }

  async function loadDocuments(q: string, more: boolean) {
    const id = ++requestId.current;
    if (more) setIsLoadingMore(true);
    else setIsLoading(true);
    setLoadError(null);
    const offsets = more ? loaded : { devis: 0, facture: 0 };
    const wants = {
      devis: !more || offsets.devis < totals.devis,
      facture: !more || offsets.facture < totals.facture,
    };
    try {
      const [devisResult, factureResult] = await Promise.all([
        wants.devis
          ? listBillingDocumentsAction("devis", PAGE_SIZE, { offset: offsets.devis, q })
          : null,
        wants.facture
          ? listBillingDocumentsAction("facture", PAGE_SIZE, { offset: offsets.facture, q })
          : null,
      ]);
      if (id !== requestId.current) return; // a newer search answered first
      const fresh: BillingDocument[] = [];
      const nextLoaded = { ...offsets };
      const nextTotals = more ? { ...totals } : { devis: 0, facture: 0 };
      if (devisResult?.ok) {
        fresh.push(...devisResult.data.items);
        nextLoaded.devis += devisResult.data.items.length;
        nextTotals.devis = devisResult.data.total;
      }
      if (factureResult?.ok) {
        fresh.push(...factureResult.data.items);
        nextLoaded.facture += factureResult.data.items.length;
        nextTotals.facture = factureResult.data.total;
      }
      // Both failed → surface error
      if (devisResult && !devisResult.ok && factureResult && !factureResult.ok) {
        setLoadError(tErrors("documentsLoadFailed"));
        if (!more) setDocuments([]);
        return;
      }
      setLoaded(nextLoaded);
      setTotals(nextTotals);
      setDocuments((prev) => {
        const base = more ? prev : [];
        const seen = new Set(base.map((d) => d.id));
        return [...base, ...fresh.filter((d) => !seen.has(d.id))].sort(byIssueDate);
      });
    } catch {
      if (id !== requestId.current) return;
      setLoadError(tErrors("documentsLoadFailed"));
      toast.error(tErrors("documentsLoadFailed"));
    } finally {
      if (id === requestId.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }

  const hasMore = loaded.devis < totals.devis || loaded.facture < totals.facture;

  function handleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  function handleConfirm() {
    if (!selectedId) return;
    onOpenChange(false);
    router.push(`/${locale}/billing/${kindToSegment(targetKind)}/new?from=${selectedId}`);
  }

  const selectedDoc = documents.find((d) => d.id === selectedId);
  const targetKindLabel = targetKind === "devis" ? tKind("kindDevis") : tKind("kindFacture");
  const crossKind = selectedDoc && selectedDoc.kind !== targetKind;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tActions("cloneSelected")}</DialogTitle>
          <DialogDescription>
            {tFromExisting.rich("description", {
              kind: targetKindLabel,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Target kind override */}
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: "var(--muted)" }}>
            {tFromExisting("createAs")}
          </span>
          <Select
            value={targetKind}
            onValueChange={(v) => setTargetKind(v as BillingDocumentKind)}
          >
            <SelectTrigger className="h-7 w-32 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="devis">{tKind("kindDevis")}</SelectItem>
              <SelectItem value="facture">{tKind("kindFacture")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {crossKind && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--warning)]/40 bg-[var(--warning-tint)] p-3 text-[13px] text-[#8e6418]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {tFromExisting.rich("crossKindWarning", {
                kind: targetKindLabel,
                draft: billingStatusLabel(tBilling, "devis", "draft"),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </span>
          </div>
        )}

        <Input
          type="search"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder={tFromExisting("search")}
          aria-label={tFromExisting("search")}
        />

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
                {search ? tFromExisting("noResults") : tFromExisting("empty")}
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
                          {doc.recipient_name} · {formatDate(toIsoDate(doc.issue_date) ?? doc.issue_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="num text-[12px] font-medium">
                        {formatTTC(doc.total_ttc)}
                      </span>
                      <BillingStatusBadge
                        status={doc.status}
                        label={billingStatusLabel(tBilling, doc.kind, doc.status)}
                      />
                      <span
                        className="text-[11px] uppercase tracking-wide"
                        style={{ color: "var(--muted)" }}
                      >
                        {doc.kind === "devis" ? tKind("kindDevis") : tKind("kindFacture")}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
              {hasMore && (
                <div className="flex justify-center p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void loadDocuments(search, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore && <Loader2 size={13} className="mr-2 animate-spin" />}
                    {tFromExisting("loadMore")}
                  </Button>
                </div>
              )}
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
