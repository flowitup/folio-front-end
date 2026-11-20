"use client";

/**
 * PaymentMethodAddForm — inline input row for adding a new payment method.
 *
 * Renders an Input, the purse the method's expenses count in and a Save
 * button (Enter to submit, Escape to cancel/clear). No purse is chosen for the
 * user: a card defaulting to "personal" filed company spending as the owner's
 * own, so the method is only added once "Company purse" or "Personal purse"
 * is picked.
 * Parent provides the async onAdd callback and a busy flag to disable the form
 * while a mutation is in flight. The typed label is cleared only when onAdd
 * reports success, so a refused label can be corrected instead of retyped.
 */

import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentPurse } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentMethodAddFormProps {
  isMutating: boolean;
  /** Resolves true when the method was added. */
  onAdd: (label: string, purse: PaymentPurse) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentMethodAddForm({ isMutating, onAdd }: PaymentMethodAddFormProps) {
  const t = useTranslations("paymentMethods");
  const tForm = useTranslations("settings.paymentMethodForm");

  const [label, setLabel] = useState("");
  const [purse, setPurse] = useState<Exclude<PaymentPurse, "none"> | "">("");
  // Shown once the user tries to add without picking a purse.
  const [purseMissing, setPurseMissing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || submittingRef.current) return;
    if (!purse) {
      setPurseMissing(true);
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (await onAdd(trimmed, purse)) {
        setLabel("");
        setPurse("");
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setLabel("");
    }
  }

  const busy = isMutating || isSubmitting;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mb-4 space-y-1.5">
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tForm("namePlaceholder")}
          disabled={busy}
          className="h-8 text-[13px]"
          aria-label={tForm("nameLabel")}
          maxLength={120}
        />
        <select
          value={purse}
          onChange={(e) => {
            setPurse(e.target.value as Exclude<PaymentPurse, "none">);
            setPurseMissing(false);
          }}
          disabled={busy}
          aria-label={t("purseLabel")}
          aria-invalid={purseMissing || undefined}
          aria-describedby={purseMissing ? "payment-method-purse-missing" : undefined}
          className="h-8 shrink-0 rounded-md border bg-background px-2 text-[13px]"
        >
          <option value="" disabled>
            {tForm("pursePlaceholder")}
          </option>
          <option value="company">{t("purseCompany")}</option>
          <option value="personal">{t("pursePersonal")}</option>
        </select>
        <Button
          type="submit"
          size="sm"
          disabled={busy || !label.trim()}
          className="h-8 shrink-0"
        >
          {isSubmitting ? (
            <Loader2 size={13} className="mr-1.5 animate-spin" />
          ) : (
            <Plus size={13} className="mr-1.5" />
          )}
          {t("addButton")}
        </Button>
      </div>
      {purseMissing && (
        <p id="payment-method-purse-missing" role="alert" className="text-[12px] text-destructive">
          {tForm("purseRequired")}
        </p>
      )}
    </form>
  );
}
