"use client";

/**
 * BillingDocumentForm — unified create / edit form for devis and factures.
 *
 * Modes:
 *   create  — blank form, or pre-filled from a source doc (?from=) or template (?template=)
 *   edit    — loads an existing document; shows status badge + actions in the header
 *
 * Layout (top → bottom):
 *   1. Header bar
 *   2. Mode picker (create + no pre-fill only)
 *   3. Recipient block
 *   4. Meta block (dates, document number read-only on edit)
 *   5. Items editor (live totals)
 *   6. Notes / Terms / Signature block
 *   7. Footer (Cancel / Save / optional Delete)
 *
 * State: plain useState (no react-hook-form). Server is source of truth.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Download, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BillingStatusMenu } from "@/components/billing/billing-status-menu";
import { BillingDocumentItemsEditor } from "@/components/billing/billing-document-items-editor";
import { CreateFromExistingDialog } from "@/components/billing/create-from-existing-dialog";
import { ApplyTemplateDialog } from "@/components/billing/apply-template-dialog";
import {
  createBillingDocumentAction,
  updateBillingDocumentAction,
  deleteBillingDocumentAction,
  convertDevisToFactureAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import { triggerBrowserDownload } from "@/lib/util/trigger-browser-download";
import { env } from "@/lib/config/env";
import { getApiAccessToken } from "@/lib/api/http";
import { parseFilenameFromContentDisposition } from "@/lib/api/_helpers/content-disposition";
import type {
  BillingDocument,
  BillingDocumentKind,
  BillingDocumentTemplate,
  BillingDocumentItem,
} from "@/types/billing";
import { kindToSegment } from "@/lib/billing/url-helpers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingDocumentFormProps =
  | {
      mode: "create";
      kind: BillingDocumentKind;
      initialFromSource?: BillingDocument;
      initialFromTemplate?: BillingDocumentTemplate;
    }
  | {
      mode: "edit";
      kind: BillingDocumentKind;
      document: BillingDocument;
    };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plus30Days(from?: string): string {
  const base = from ? new Date(from) : new Date();
  base.setDate(base.getDate() + 30);
  return base.toISOString().slice(0, 10);
}

type CreateMode = "blank" | "from-existing" | "from-template";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingDocumentForm(props: BillingDocumentFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const tForm = useTranslations("billing.form");
  const isEdit = props.mode === "edit";
  const kind = props.kind;

  // Seed initial values from source / template / document
  const seed =
    props.mode === "edit"
      ? props.document
      : props.initialFromSource ?? null;
  const templateSeed =
    props.mode === "create" ? props.initialFromTemplate : null;

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  const [createMode, setCreateMode] = useState<CreateMode>(
    props.mode === "create" && !props.initialFromSource && !props.initialFromTemplate
      ? "blank"
      : "blank" // dialogs handle the navigation; mode-picker just opens them
  );
  const [fromExistingOpen, setFromExistingOpen] = useState(false);
  const [fromTemplateOpen, setFromTemplateOpen] = useState(false);

  const [recipientName, setRecipientName] = useState(seed?.recipient_name ?? "");
  const [recipientAddress, setRecipientAddress] = useState(seed?.recipient_address ?? "");
  const [recipientEmail, setRecipientEmail] = useState(seed?.recipient_email ?? "");
  const [recipientSiret, setRecipientSiret] = useState(seed?.recipient_siret ?? "");
  const [showExtraRecipient, setShowExtraRecipient] = useState(
    !!(seed?.recipient_email || seed?.recipient_siret)
  );

  const today = todayIso();
  const [issueDate, setIssueDate] = useState(seed?.issue_date ?? today);
  const [validityUntil, setValidityUntil] = useState(
    seed?.validity_until ?? plus30Days(seed?.issue_date)
  );
  const [paymentDueDate, setPaymentDueDate] = useState(
    seed?.payment_due_date ?? plus30Days(seed?.issue_date)
  );
  const [paymentTerms, setPaymentTerms] = useState(seed?.payment_terms ?? "");

  const [items, setItems] = useState<BillingDocumentItem[]>(
    seed?.items ?? templateSeed?.items ?? []
  );
  const [notes, setNotes] = useState(seed?.notes ?? templateSeed?.notes ?? "");
  const [terms, setTerms] = useState(seed?.terms ?? templateSeed?.terms ?? "");
  const [signatureBlock, setSignatureBlock] = useState(seed?.signature_block_text ?? "");

  // Edit-mode live document state (updated after status change)
  const [liveDoc, setLiveDoc] = useState<BillingDocument | null>(
    isEdit ? props.document : null
  );

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Double-submit guards (ref-based — synchronous check before first React commit)
  const submittingRef = useRef(false);
  const pdfLoadingRef = useRef(false);
  const convertingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): string | null {
    if (!recipientName.trim()) return tForm("errors.recipientRequired");
    if (items.length === 0) return tForm("errors.atLeastOneItem");
    for (const item of items) {
      if (!item.description.trim()) return tForm("errors.itemDescriptionRequired");
      if (Number(item.quantity) <= 0) return tForm("errors.itemQuantityPositive");
      if (Number(item.unit_price) < 0) return tForm("errors.itemUnitPricePositive");
      if (Number(item.vat_rate) < 0) return tForm("errors.itemVatRatePositive");
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    const err = validate();
    if (err) { setFormError(err); submittingRef.current = false; return; }
    setFormError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        recipient_name: recipientName.trim(),
        recipient_address: recipientAddress.trim() || null,
        recipient_email: recipientEmail.trim() || null,
        recipient_siret: recipientSiret.trim() || null,
        issue_date: issueDate,
        validity_until: kind === "devis" ? validityUntil : null,
        payment_due_date: kind === "facture" ? paymentDueDate : null,
        payment_terms: kind === "facture" ? (paymentTerms.trim() || null) : null,
        items,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        signature_block_text: signatureBlock.trim() || null,
      };

      if (isEdit && liveDoc) {
        const result = await updateBillingDocumentAction(liveDoc.id, payload);
        if (!result.ok) { setFormError(result.error.message); return; }
        toast.success("Document saved.");
        setLiveDoc(result.data);
      } else {
        const result = await createBillingDocumentAction({ kind, ...payload });
        if (!result.ok) { setFormError(result.error.message); return; }
        toast.success("Document created.");
        router.push(`/${locale}/billing/${kindToSegment(kind)}/${result.data.id}`);
      }
    } catch {
      setFormError(tForm("errors.saveFailed"));
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  async function handleDelete() {
    if (submittingRef.current) return;
    if (!liveDoc) return;
    submittingRef.current = true;
    try {
      const result = await deleteBillingDocumentAction(liveDoc.id);
      if (!result.ok) { toast.error(result.error.message); return; }
      toast.success("Document deleted.");
      router.push(`/${locale}/billing/${kindToSegment(kind)}`);
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleDownloadPdf() {
    if (pdfLoadingRef.current) return;
    if (!liveDoc) return;
    pdfLoadingRef.current = true;
    setIsPdfLoading(true);
    try {
      const token = getApiAccessToken();
      const response = await fetch(
        `${env.apiBaseUrl}/billing-documents/${encodeURIComponent(liveDoc.id)}/pdf`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const cd = response.headers.get("Content-Disposition");
      const filename = parseFilenameFromContentDisposition(cd, `${liveDoc.document_number}.pdf`);
      const blob = await response.blob();
      triggerBrowserDownload(blob, filename);
      toast.success("PDF downloaded.");
    } catch {
      toast.error(tForm("errors.pdfFailed"));
    } finally {
      setIsPdfLoading(false);
      pdfLoadingRef.current = false;
    }
  }

  async function handleConvert() {
    if (convertingRef.current) return;
    if (!liveDoc) return;
    convertingRef.current = true;
    setIsConverting(true);
    try {
      const result = await convertDevisToFactureAction(liveDoc.id);
      if (!result.ok) {
        if (result.error.code === "conflict") {
          toast.error(tForm("errors.alreadyConverted"));
        } else {
          toast.error(result.error.message);
        }
        return;
      }
      toast.success("Devis converted to facture.");
      router.push(`/${locale}/billing/factures/${result.data.id}`);
    } catch {
      toast.error(tForm("errors.convertFailed"));
    } finally {
      setIsConverting(false);
      convertingRef.current = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const showConvertButton =
    isEdit && liveDoc?.kind === "devis" && liveDoc.status === "accepted";

  const kindLabel = kind === "devis" ? "Devis" : "Facture";
  const listPath = `/${locale}/billing/${kindToSegment(kind)}`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fade-up space-y-6 px-8 pb-16">
      {/* 1. Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(listPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-xl font-medium">
          {isEdit
            ? (liveDoc?.document_number ?? kindLabel)
            : `New ${kindLabel}`}
        </h2>

        {isEdit && liveDoc && (
          <>
            <BillingStatusMenu
              document={liveDoc}
              onStatusChanged={setLiveDoc}
            />
            <div className="ml-auto flex items-center gap-2">
              {showConvertButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConvert}
                  disabled={isConverting}
                >
                  {isConverting ? (
                    <Loader2 size={13} className="mr-2 animate-spin" />
                  ) : (
                    <ArrowRightLeft size={13} className="mr-2" />
                  )}
                  {tForm("actions.convertToFacture")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isPdfLoading}
              >
                {isPdfLoading ? (
                  <Loader2 size={13} className="mr-2 animate-spin" />
                ) : (
                  <Download size={13} className="mr-2" />
                )}
                {tForm("actions.downloadPdf")}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* 2. Mode picker (create, no pre-fill) */}
      {!isEdit &&
        !props.initialFromSource &&
        !props.initialFromTemplate && (
          <div className="folio-card flex gap-2 p-4">
            <Button
              type="button"
              variant={createMode === "blank" ? "default" : "outline"}
              size="sm"
              onClick={() => setCreateMode("blank")}
            >
              {tForm("modes.blank")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFromExistingOpen(true)}
            >
              {tForm("modes.fromExisting")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFromTemplateOpen(true)}
            >
              {tForm("modes.fromTemplate")}
            </Button>
          </div>
        )}

      {/* 3. Recipient block */}
      <div className="folio-card space-y-4 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {tForm("recipient.section")}
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="recipient-name" className="text-[12px]">
              {tForm("recipient.name")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="recipient-name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={tForm("recipient.namePlaceholder")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="recipient-address" className="text-[12px]">{tForm("recipient.address")}</Label>
            <Textarea
              id="recipient-address"
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              placeholder={tForm("recipient.addressPlaceholder")}
              rows={2}
              className="resize-none"
            />
          </div>

          {!showExtraRecipient ? (
            <button
              type="button"
              className="text-[12px] underline"
              style={{ color: "var(--muted)" }}
              onClick={() => setShowExtraRecipient(true)}
            >
              {tForm("recipient.addExtraFields")}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="recipient-email" className="text-[12px]">{tForm("recipient.email")}</Label>
                <Input
                  id="recipient-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={tForm("recipient.emailPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="recipient-siret" className="text-[12px]">{tForm("recipient.siret")}</Label>
                <Input
                  id="recipient-siret"
                  value={recipientSiret}
                  onChange={(e) => setRecipientSiret(e.target.value)}
                  placeholder={tForm("recipient.siretPlaceholder")}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Meta block */}
      <div className="folio-card space-y-4 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {tForm("details.section")}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {isEdit && liveDoc && (
            <div className="space-y-1">
              <Label className="text-[12px]">{tForm("details.documentNumber")}</Label>
              <p className="num h-9 rounded-md border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                {liveDoc.document_number}
              </p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="issue-date" className="text-[12px]">{tForm("details.issueDate")}</Label>
            <Input
              id="issue-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          {kind === "devis" && (
            <div className="space-y-1">
              <Label htmlFor="validity-until" className="text-[12px]">{tForm("details.validityUntil")}</Label>
              <Input
                id="validity-until"
                type="date"
                value={validityUntil}
                onChange={(e) => setValidityUntil(e.target.value)}
              />
            </div>
          )}
          {kind === "facture" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="payment-due" className="text-[12px]">{tForm("details.paymentDue")}</Label>
                <Input
                  id="payment-due"
                  type="date"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                />
              </div>
              <div className="col-span-full space-y-1">
                <Label htmlFor="payment-terms" className="text-[12px]">{tForm("details.paymentTerms")}</Label>
                <Input
                  id="payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder={tForm("details.paymentTermsPlaceholder")}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 5. Items editor */}
      <div className="space-y-2">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {tForm("items.section")}
        </p>
        <BillingDocumentItemsEditor items={items} onChange={setItems} />
      </div>

      {/* 6. Notes / Terms / Signature */}
      <div className="folio-card space-y-4 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          {tForm("notes.section")}
        </p>
        <div className="space-y-1">
          <Label htmlFor="notes" className="text-[12px]">{tForm("notes.notes")}</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tForm("notes.notesPlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="terms" className="text-[12px]">{tForm("notes.terms")}</Label>
          <Textarea
            id="terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder={tForm("notes.termsPlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signature-block" className="text-[12px]">{tForm("notes.signatureBlock")}</Label>
          <Textarea
            id="signature-block"
            value={signatureBlock}
            onChange={(e) => setSignatureBlock(e.target.value)}
            placeholder={tForm("notes.signatureBlockPlaceholder")}
            rows={2}
            className="resize-none"
          />
        </div>
      </div>

      {/* Error banner */}
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {/* 7. Footer */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(listPath)}
          disabled={isSubmitting}
        >
          {tForm("actions.cancel")}
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 size={13} className="mr-2 animate-spin" />
          ) : null}
          {isEdit ? tForm("actions.save") : tForm("actions.create")}
        </Button>
        {isEdit && (
          <Button
            type="button"
            variant="outline"
            className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-600"
            onClick={handleDelete}
            disabled={isSubmitting}
          >
            {tForm("actions.delete")}
          </Button>
        )}
      </div>

      {/* Dialogs */}
      <CreateFromExistingDialog
        open={fromExistingOpen}
        onOpenChange={setFromExistingOpen}
        kind={kind}
      />
      <ApplyTemplateDialog
        open={fromTemplateOpen}
        onOpenChange={setFromTemplateOpen}
        kind={kind}
      />
    </div>
  );
}
