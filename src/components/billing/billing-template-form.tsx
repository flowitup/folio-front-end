"use client";

/**
 * BillingTemplateForm — create / edit form for billing document templates.
 *
 * Modes:
 *   create — blank or pre-seeded kind via query param
 *   edit   — loads an existing template; kind is immutable (disabled + note)
 *
 * Layout:
 *   1. Header (back + title)
 *   2. Kind select (disabled on edit)
 *   3. Name input
 *   4. Default VAT rate select
 *   5. Items editor (no totals — templates don't show totals)
 *   6. Notes / Terms
 *   7. Footer (Cancel / Save / Delete on edit)
 *
 * Duplicate name within (user, kind) → 409 from BE → surfaces inline.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { ArrowLeft, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BillingDocumentItemsEditor } from "@/components/billing/billing-document-items-editor";
import {
  createBillingTemplateAction,
  updateBillingTemplateAction,
  deleteBillingTemplateAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type {
  BillingDocumentTemplate,
  BillingDocumentKind,
  BillingDocumentItem,
} from "@/types/billing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_VAT_RATES = ["20", "10", "5.5", "0"];
const TEMPLATES_PATH = "/billing/templates";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type BillingTemplateFormProps =
  | {
      mode: "create";
      initialKind?: BillingDocumentKind;
    }
  | {
      mode: "edit";
      template: BillingDocumentTemplate;
    };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BillingTemplateForm(props: BillingTemplateFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const isEdit = props.mode === "edit";
  const template = isEdit ? props.template : null;

  // ---------------------------------------------------------------------------
  // Form state
  // ---------------------------------------------------------------------------

  const [kind, setKind] = useState<BillingDocumentKind>(
    isEdit ? template!.kind : (props as { mode: "create"; initialKind?: BillingDocumentKind }).initialKind ?? "devis"
  );
  const [name, setName] = useState(template?.name ?? "");
  const [defaultVatRate, setDefaultVatRate] = useState<string>(
    template?.default_vat_rate ?? "20"
  );
  const [customVatRate, setCustomVatRate] = useState<string>(
    template?.default_vat_rate && !PRESET_VAT_RATES.includes(template.default_vat_rate)
      ? template.default_vat_rate
      : ""
  );
  const [isCustomVat, setIsCustomVat] = useState(
    !!(template?.default_vat_rate && !PRESET_VAT_RATES.includes(template.default_vat_rate))
  );
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [terms, setTerms] = useState(template?.terms ?? "");
  const [items, setItems] = useState<BillingDocumentItem[]>(template?.items ?? []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const effectiveVatRate = isCustomVat ? customVatRate : defaultVatRate;
  const listPath = `/${locale}${TEMPLATES_PATH}`;

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): string | null {
    if (!name.trim()) return "Template name is required.";
    if (name.trim().length > 120) return "Template name must be 120 characters or fewer.";
    if (!kind) return "Kind is required.";
    return null;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        items,
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        default_vat_rate: effectiveVatRate || null,
      };

      if (isEdit) {
        const result = await updateBillingTemplateAction(template!.id, payload);
        if (!result.ok) {
          if (result.error.code === "conflict") {
            setFormError("A template with this name already exists for this kind.");
          } else {
            setFormError(result.error.message);
          }
          return;
        }
        toast.success("Template saved.");
        router.push(listPath);
      } else {
        const result = await createBillingTemplateAction({ kind, ...payload });
        if (!result.ok) {
          if (result.error.code === "conflict") {
            setFormError("A template with this name already exists for this kind.");
          } else {
            setFormError(result.error.message);
          }
          return;
        }
        toast.success("Template created.");
        router.push(listPath);
      }
    } catch {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!template) return;
    const result = await deleteBillingTemplateAction(template.id);
    if (!result.ok) {
      toast.error("Failed to delete template. Please try again.");
      return;
    }
    toast.success("Template deleted.");
    router.push(listPath);
  }

  function handleVatRateChange(value: string) {
    if (value === "__custom__") {
      setIsCustomVat(true);
      setCustomVatRate("");
    } else {
      setIsCustomVat(false);
      setDefaultVatRate(value);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fade-up space-y-6 px-8 pb-16">
      {/* 1. Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(listPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-display text-xl font-medium">
          {isEdit ? "Edit template" : "New template"}
        </h2>
      </div>

      {/* 2. Core fields */}
      <div className="folio-card space-y-5 p-5">
        {/* Kind */}
        <div className="space-y-1">
          <Label htmlFor="tpl-kind" className="text-[12px]">
            Kind <span className="text-red-500">*</span>
          </Label>
          {isEdit ? (
            <div className="space-y-1">
              <div
                className="flex h-9 w-full items-center rounded-md border px-3 text-sm"
                style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--muted-bg, #f9fafb)" }}
              >
                {kind === "devis" ? "Devis" : "Facture"}
              </div>
              <p className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
                <Info size={11} />
                Kind cannot be changed after creation.
              </p>
            </div>
          ) : (
            <Select value={kind} onValueChange={(v) => setKind(v as BillingDocumentKind)}>
              <SelectTrigger id="tpl-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="devis">Devis</SelectItem>
                <SelectItem value="facture">Facture</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Name */}
        <div className="space-y-1">
          <Label htmlFor="tpl-name" className="text-[12px]">
            Template name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard web project"
            maxLength={120}
          />
        </div>

        {/* Default VAT rate */}
        <div className="space-y-1">
          <Label htmlFor="tpl-vat" className="text-[12px]">Default VAT rate</Label>
          {isCustomVat ? (
            <div className="flex items-center gap-2">
              <Input
                id="tpl-vat"
                type="number"
                min="0"
                max="100"
                step="any"
                value={customVatRate}
                onChange={(e) => setCustomVatRate(e.target.value)}
                className="w-28"
                placeholder="e.g. 8.5"
              />
              <span className="text-sm" style={{ color: "var(--muted)" }}>%</span>
              <button
                type="button"
                className="text-[12px] underline"
                style={{ color: "var(--muted)" }}
                onClick={() => { setIsCustomVat(false); setDefaultVatRate("20"); }}
              >
                ↩ Use preset
              </button>
            </div>
          ) : (
            <Select value={defaultVatRate} onValueChange={handleVatRateChange}>
              <SelectTrigger id="tpl-vat" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESET_VAT_RATES.map((r) => (
                  <SelectItem key={r} value={r}>{r}%</SelectItem>
                ))}
                <SelectItem value="__custom__">Custom…</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* 3. Items editor (no totals card) */}
      <div className="space-y-2">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Line items
        </p>
        <BillingDocumentItemsEditor items={items} onChange={setItems} showTotals={false} />
      </div>

      {/* 4. Notes & Terms */}
      <div className="folio-card space-y-4 p-5">
        <p className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Notes &amp; terms
        </p>
        <div className="space-y-1">
          <Label htmlFor="tpl-notes" className="text-[12px]">Notes</Label>
          <Textarea
            id="tpl-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal or client-facing notes"
            rows={3}
            className="resize-none"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-terms" className="text-[12px]">General terms (CGV)</Label>
          <Textarea
            id="tpl-terms"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            placeholder="General terms and conditions"
            rows={3}
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

      {/* 5. Footer */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(listPath)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 size={13} className="mr-2 animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create template"}
        </Button>

        {isEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-600"
                disabled={isSubmitting}
              >
                Delete template
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete &ldquo;{template!.name}&rdquo;? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
