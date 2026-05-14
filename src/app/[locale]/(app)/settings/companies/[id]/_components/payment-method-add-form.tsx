"use client";

/**
 * PaymentMethodAddForm — inline input row for adding a new payment method.
 *
 * Renders a single Input + Save button (Enter to submit, Escape to cancel/clear).
 * Parent provides the async onAdd callback and a busy flag to disable the form
 * while a mutation is in flight.
 */

import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentMethodAddFormProps {
  isMutating: boolean;
  onAdd: (label: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentMethodAddForm({ isMutating, onAdd }: PaymentMethodAddFormProps) {
  const t = useTranslations("paymentMethods");

  const [label, setLabel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onAdd(trimmed);
      setLabel("");
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
        maxLength={100}
      />
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
