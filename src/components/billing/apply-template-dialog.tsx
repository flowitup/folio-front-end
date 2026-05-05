"use client";

/**
 * ApplyTemplateDialog — pick a saved template to create a new billing document.
 *
 * Behaviour:
 *   1. Load templates filtered by kind.
 *   2. User picks a template → inline recipient fields appear (required).
 *   3. On confirm → calls createBillingDocumentFromTemplateAction →
 *      on success: redirect to /billing/<kind>/<new_id> (edit page).
 *   4. On API error: toast + keep dialog open.
 *
 * State: plain useState, no form library.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listBillingTemplatesAction,
  createBillingDocumentFromTemplateAction,
} from "@/app/[locale]/(app)/billing/_actions/billing-actions";
import type { BillingDocumentKind, BillingDocumentTemplate } from "@/types/billing";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApplyTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: BillingDocumentKind;
}

// ---------------------------------------------------------------------------
// Recipient field state
// ---------------------------------------------------------------------------

interface RecipientFields {
  recipient_name: string;
  recipient_address: string;
  recipient_email: string;
  recipient_siret: string;
}

function emptyRecipient(): RecipientFields {
  return {
    recipient_name: "",
    recipient_address: "",
    recipient_email: "",
    recipient_siret: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApplyTemplateDialog({
  open,
  onOpenChange,
  kind,
}: ApplyTemplateDialogProps) {
  const router = useRouter();
  const locale = useLocale();

  const [templates, setTemplates] = useState<BillingDocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<RecipientFields>(emptyRecipient());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null);

  // Reset + load on open
  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setRecipient(emptyRecipient());
      setNameError(null);
      loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadTemplates() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listBillingTemplatesAction(kind);
      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }
      setTemplates(result.data);
    } catch {
      setLoadError("Failed to load templates.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleRecipientChange(field: keyof RecipientFields, value: string) {
    setRecipient((prev) => ({ ...prev, [field]: value }));
    if (field === "recipient_name" && value.trim()) setNameError(null);
  }

  async function handleConfirm() {
    if (!selectedId) return;

    // Client-side validation
    if (!recipient.recipient_name.trim()) {
      setNameError("Recipient name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createBillingDocumentFromTemplateAction(selectedId, {
        recipient_name: recipient.recipient_name.trim(),
        recipient_address: recipient.recipient_address.trim() || null,
        recipient_email: recipient.recipient_email.trim() || null,
        recipient_siret: recipient.recipient_siret.trim() || null,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Document created from template.");
      onOpenChange(false);
      router.push(`/${locale}/billing/${kind}/${result.data.id}`);
    } catch {
      toast.error("Failed to create document from template.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Apply a template</DialogTitle>
          <DialogDescription>
            Choose a saved template. Items, notes and terms will be copied.
            Enter the recipient details below before creating.
          </DialogDescription>
        </DialogHeader>

        {/* Template list */}
        <div
          className="max-h-52 overflow-y-auto rounded-md border"
          style={{ borderColor: "var(--border)" }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: "var(--muted)" }}
              />
            </div>
          ) : loadError ? (
            <div
              className="py-8 text-center text-[13px]"
              style={{ color: "var(--muted)" }}
            >
              {loadError}
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10">
              <FileText size={20} style={{ color: "var(--muted)" }} />
              <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                No {kind} templates saved yet.
              </p>
            </div>
          ) : (
            <div
              className="divide-y"
              style={{ borderColor: "var(--border)" }}
            >
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() =>
                    setSelectedId((prev) => (prev === tpl.id ? null : tpl.id))
                  }
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--paper-2)] ${
                    selectedId === tpl.id ? "bg-[var(--paper-2)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors ${
                        selectedId === tpl.id
                          ? "border-[var(--ink)] bg-[var(--ink)]"
                          : "border-[var(--muted)] bg-transparent"
                      }`}
                    />
                    <div>
                      <p className="text-[13px] font-medium">{tpl.name}</p>
                      <p
                        className="text-[12px]"
                        style={{ color: "var(--muted)" }}
                      >
                        {tpl.items.length} line item
                        {tpl.items.length !== 1 ? "s" : ""}
                        {tpl.default_vat_rate
                          ? ` · ${tpl.default_vat_rate}% default VAT`
                          : ""}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recipient fields — shown once a template is selected */}
        {selectedTemplate && (
          <div className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[13px] font-medium">Recipient details</p>

            <div className="space-y-1">
              <Label htmlFor="tpl-recipient-name" className="text-[12px]">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tpl-recipient-name"
                value={recipient.recipient_name}
                onChange={(e) =>
                  handleRecipientChange("recipient_name", e.target.value)
                }
                placeholder="Client or company name"
                className={nameError ? "border-red-400" : ""}
              />
              {nameError && (
                <p className="text-[12px] text-red-500">{nameError}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="tpl-recipient-address" className="text-[12px]">
                Address
              </Label>
              <Textarea
                id="tpl-recipient-address"
                value={recipient.recipient_address}
                onChange={(e) =>
                  handleRecipientChange("recipient_address", e.target.value)
                }
                placeholder="Street, city, postal code"
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tpl-recipient-email" className="text-[12px]">
                  Email
                </Label>
                <Input
                  id="tpl-recipient-email"
                  type="email"
                  value={recipient.recipient_email}
                  onChange={(e) =>
                    handleRecipientChange("recipient_email", e.target.value)
                  }
                  placeholder="client@example.com"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tpl-recipient-siret" className="text-[12px]">
                  SIRET
                </Label>
                <Input
                  id="tpl-recipient-siret"
                  value={recipient.recipient_siret}
                  onChange={(e) =>
                    handleRecipientChange("recipient_siret", e.target.value)
                  }
                  placeholder="123 456 789 00012"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 size={13} className="mr-2 animate-spin" />
            ) : null}
            Create from template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
