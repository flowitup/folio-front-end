"use client";

/**
 * PaymentMethodAddForm — inline input row for adding a new payment method.
 *
 * Renders an Input, the purse the method's expenses count in (personal by
 * default, so a new method never leaves its expenses in no purse) and a Save
 * button (Enter to submit, Escape to cancel/clear).
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

  const [label, setLabel] = useState("");
  const [purse, setPurse] = useState<PaymentPurse>("personal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (await onAdd(trimmed, purse)) setLabel("");
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
    <form onSubmit={(e) => void handleSubmit(e)} className="flex gap-2 mb-4">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("addPlaceholder")}
        disabled={busy}
        className="h-8 text-[13px]"
        aria-label={t("addPlaceholder")}
        maxLength={120}
      />
      <select
        value={purse}
        onChange={(e) => setPurse(e.target.value as PaymentPurse)}
        disabled={busy}
        aria-label={t("purseLabel")}
        className="h-8 shrink-0 rounded-md border bg-background px-2 text-[13px]"
      >
        <option value="personal">{t("pursePersonal")}</option>
        <option value="company">{t("purseCompany")}</option>
        <option value="none">{t("purseNone")}</option>
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
    </form>
  );
}
