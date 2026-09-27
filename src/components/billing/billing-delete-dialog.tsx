"use client";

/**
 * BillingDeleteDialog — confirmation before a billing document is deleted.
 * Shared by the list's row menu and the document form so both ask the same way.
 */

import { useTranslations } from "next-intl";
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

interface BillingDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentNumber: string;
  onConfirm: () => void;
}

export function BillingDeleteDialog({
  open,
  onOpenChange,
  documentNumber,
  onConfirm,
}: BillingDeleteDialogProps) {
  const tActions = useTranslations("billing.form.actions");
  const tDeleteDialog = useTranslations("billing.form.deleteDialog");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tDeleteDialog("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {tDeleteDialog.rich("description", {
              number: documentNumber,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tActions("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 focus:ring-destructive"
          >
            {tActions("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
