"use client";

/**
 * InventoryItemDeleteDialog — AlertDialog for removing one inventory row.
 * A plain confirmation (no typed name): a row is a count at a place, not a
 * record with history like a library product.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteInventoryItemAction } from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import type { InventoryItem } from "@/lib/api/inventory";

interface Props {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void | Promise<void>;
}

export function InventoryItemDeleteDialog({ item, open, onOpenChange, onDeleted }: Props) {
  const t = useTranslations("inventory");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    const result = await deleteInventoryItemAction(item.id);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.code === "Forbidden" ? t("toast.forbidden") : t("toast.deleteError"));
      setIsDeleting(false);
      return;
    }
    toast.success(t("toast.deleted"));
    await onDeleted(item.id);
    setIsDeleting(false);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isDeleting && onOpenChange(o)}>
      <AlertDialogContent className="max-w-sm sm:max-w-md">
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--negative-tint)" }}
          >
            <Trash2 size={20} style={{ color: "var(--negative)" }} />
          </div>
          <div className="space-y-1 text-center">
            <AlertDialogTitle className="font-display text-center">
              {t("deleteConfirm", { name: item.name })}
            </AlertDialogTitle>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {t("deleteHint")}
            </p>
          </div>
        </div>
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        <AlertDialogFooter className="gap-2 sm:justify-center">
          <AlertDialogCancel disabled={isDeleting}>{t("actions.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            style={{ background: "var(--negative)", color: "white" }}
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
