"use client";

/**
 * PaymentMethodRow — single row in the payment methods list.
 *
 * Supports inline label editing and isCompanyPayment toggle (for all methods)
 * and delete action (disabled for built-ins). The delete confirmation dialog
 * is managed by the parent; this component only fires the callbacks.
 */

import { useRef, useState } from "react";
import { Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { localizeMethodLabel } from "@/lib/payment-methods/localize-method-label";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentMethodRowProps {
  method: PaymentMethod;
  isMutating: boolean;
  onRenameRequest: (id: string, newLabel: string, isCompanyPayment: boolean) => Promise<void>;
  onDeleteRequest: (method: PaymentMethod) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentMethodRow({
  method,
  isMutating,
  onRenameRequest,
  onDeleteRequest,
}: PaymentMethodRowProps) {
  const t = useTranslations("paymentMethods");
  const tBuiltins = useTranslations("paymentMethods.builtins");
  const displayLabel = localizeMethodLabel(method.label, tBuiltins);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(method.label);
  const [editIsCompanyPayment, setEditIsCompanyPayment] = useState(method.isCompanyPayment);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function startEdit() {
    setEditValue(method.label);
    setEditIsCompanyPayment(method.isCompanyPayment);
    setIsEditing(true);
  }

  function cancelEdit() {
    setEditValue(method.label);
    setEditIsCompanyPayment(method.isCompanyPayment);
    setIsEditing(false);
  }

  async function handleSave() {
    const trimmed = editValue.trim();
    // Resolve effective label: keep original if input was cleared
    const effectiveLabel = trimmed || method.label;
    const labelChanged = effectiveLabel !== method.label;
    const companyPaymentChanged = editIsCompanyPayment !== method.isCompanyPayment;
    // Nothing actually changed — bail without a network call
    if ((!labelChanged && !companyPaymentChanged) || savingRef.current) {
      setIsEditing(false);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onRenameRequest(method.id, effectiveLabel, editIsCompanyPayment);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
      savingRef.current = false;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") {
      cancelEdit();
    }
  }

  const rowDisabled = isMutating || isSaving;

  return (
    <li className="flex items-center gap-2 py-2 border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
      {/* Label / inline edit */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex flex-col gap-1.5">
            <Input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              className="h-7 text-[13px] py-0"
              aria-label={t("title")}
            />
            <label className="flex items-center gap-2 text-[12px] cursor-pointer select-none">
              <input
                type="checkbox"
                id={`is-company-payment-${method.id}`}
                checked={editIsCompanyPayment}
                onChange={(e) => setEditIsCompanyPayment(e.target.checked)}
                disabled={isSaving}
                className="h-3.5 w-3.5 cursor-pointer"
              />
              {t("paidByCompany")}
            </label>
          </div>
        ) : (
          <span className="text-[13px] truncate block">{displayLabel}</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {method.isCompanyPayment && !isEditing && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {t("paidByCompany")}
          </Badge>
        )}
        {method.isBuiltin && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            {t("builtin")}
          </Badge>
        )}
        {method.usageCount > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
            {t("usedInInvoices", { count: method.usageCount })}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isEditing ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void handleSave()}
              disabled={isSaving || !editValue.trim()}
              aria-label={t("deleteConfirmCta")}
            >
              {isSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={cancelEdit}
              disabled={isSaving}
              aria-label={t("cancelEditAria")}
            >
              <X size={13} />
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={startEdit}
              disabled={rowDisabled}
              aria-label={t("editLabelAria", { name: displayLabel })}
            >
              <Pencil size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteRequest(method)}
              disabled={rowDisabled || method.isBuiltin}
              aria-label={t("deleteLabelAria", { name: displayLabel })}
              title={method.isBuiltin ? t("errors.builtin_protected") : undefined}
            >
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
