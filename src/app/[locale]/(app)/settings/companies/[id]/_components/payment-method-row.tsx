"use client";

/**
 * PaymentMethodRow — single row in the payment methods list.
 *
 * Supports inline label editing (for all methods) and delete action
 * (disabled for built-ins). The delete confirmation dialog is managed
 * by the parent; this component only fires the callbacks.
 */

import { useRef, useState } from "react";
import { Loader2, Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentMethodRowProps {
  method: PaymentMethod;
  isMutating: boolean;
  onRenameRequest: (id: string, newLabel: string) => Promise<void>;
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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(method.label);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  function startEdit() {
    setEditValue(method.label);
    setIsEditing(true);
  }

  function cancelEdit() {
    setEditValue(method.label);
    setIsEditing(false);
  }

  async function handleSave() {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === method.label || savingRef.current) {
      setIsEditing(false);
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onRenameRequest(method.id, trimmed);
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
          <Input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="h-7 text-[13px] py-0"
            aria-label="Edit payment method label"
          />
        ) : (
          <span className="text-[13px] truncate block">{method.label}</span>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {method.isBuiltin && (
          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
            Built-in
          </Badge>
        )}
        {method.usageCount > 0 && (
          <span className="text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
            {method.usageCount} invoice{method.usageCount !== 1 ? "s" : ""}
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
              aria-label="Save label"
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
              aria-label="Cancel edit"
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
              aria-label={`Edit "${method.label}"`}
            >
              <Pencil size={13} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDeleteRequest(method)}
              disabled={rowDisabled || method.isBuiltin}
              aria-label={`Delete "${method.label}"`}
              title={method.isBuiltin ? "Built-in methods cannot be deleted" : undefined}
            >
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
