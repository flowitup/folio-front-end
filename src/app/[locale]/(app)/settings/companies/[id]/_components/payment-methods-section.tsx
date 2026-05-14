"use client";

/**
 * PaymentMethodsSection — Card-based UI for managing company payment methods.
 *
 * Rendered by the server page which passes the initial server-fetched list.
 * After each mutation (add / rename / delete) the section refetches from the
 * server action so usage_count stays accurate.
 *
 * Split across three files:
 *   - payment-methods-section.tsx   (this file — Card, list, dialog state)
 *   - payment-method-row.tsx        (single row with edit-in-place + badges)
 *   - payment-method-add-form.tsx   (inline-add input)
 */

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
} from "../_actions/payment-methods-actions";
import { PaymentMethodRow } from "./payment-method-row";
import { PaymentMethodAddForm } from "./payment-method-add-form";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentMethodsSectionProps {
  initial: PaymentMethod[];
  companyId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaymentMethodsSection({
  initial,
  companyId,
}: PaymentMethodsSectionProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>(initial);
  const [isMutating, setIsMutating] = useState(false);
  const mutatingRef = useRef(false);

  // Delete confirm dialog state
  const [deletingMethod, setDeletingMethod] = useState<PaymentMethod | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Guard: only one mutation at a time
  // ---------------------------------------------------------------------------

  function startMutation(): boolean {
    if (mutatingRef.current) return false;
    mutatingRef.current = true;
    setIsMutating(true);
    return true;
  }

  function endMutation() {
    setIsMutating(false);
    mutatingRef.current = false;
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleAdd(label: string) {
    if (!startMutation()) return;
    try {
      const result = await createPaymentMethodAction(companyId, label);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setMethods(result.data);
      toast.success(`"${label}" added.`);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      endMutation();
    }
  }

  async function handleRename(id: string, newLabel: string) {
    if (!startMutation()) return;
    try {
      const result = await updatePaymentMethodAction(companyId, id, { label: newLabel });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setMethods(result.data);
      toast.success("Payment method renamed.");
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      endMutation();
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingMethod || deletingRef.current) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const result = await deletePaymentMethodAction(companyId, deletingMethod.id);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      const label = deletingMethod.label;
      setMethods(result.data);
      setDeletingMethod(null);
      toast.success(`"${label}" deleted.`);
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
      deletingRef.current = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-[16px]">Payment Methods</CardTitle>
          <CardDescription className="text-[13px]">
            Manage the payment methods available when creating invoices. Built-in
            methods can be renamed but not deleted.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <PaymentMethodAddForm isMutating={isMutating} onAdd={handleAdd} />

          {methods.length === 0 ? (
            <p className="text-[13px] py-4 text-center" style={{ color: "var(--muted)" }}>
              No payment methods yet. Add one above.
            </p>
          ) : (
            <ul className="divide-y-0" aria-label="Payment methods">
              {methods.map((m) => (
                <PaymentMethodRow
                  key={m.id}
                  method={m}
                  isMutating={isMutating}
                  onRenameRequest={handleRename}
                  onDeleteRequest={setDeletingMethod}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm dialog */}
      <AlertDialog
        open={!!deletingMethod}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingMethod(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment method</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingMethod && deletingMethod.usageCount > 0 ? (
                <>
                  <strong>&ldquo;{deletingMethod.label}&rdquo;</strong> is referenced in{" "}
                  {deletingMethod.usageCount} invoice
                  {deletingMethod.usageCount !== 1 ? "s" : ""}. Those invoices will keep
                  their snapshot label. This action cannot be undone.
                </>
              ) : (
                <>
                  Delete <strong>&ldquo;{deletingMethod?.label}&rdquo;</strong>? This
                  action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
