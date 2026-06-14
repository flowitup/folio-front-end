"use client";

/**
 * ProductDeleteDialog — AlertDialog for deleting a library product.
 *
 * Mirrors delete-project-dialog.tsx: Trash2 icon in negative-tint circle,
 * typed-name confirmation to enable the destructive action, isDeleting spinner.
 *
 * Warning text includes the product's purchase_count (ICU plural).
 * Calls deleteProductAction then awaits onDeleted before closing.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { deleteProductAction } from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { LibraryProduct } from "@/lib/api/bibliotheque";

interface ProductDeleteDialogProps {
  product: LibraryProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void | Promise<void>;
}

export function ProductDeleteDialog({
  product,
  open,
  onOpenChange,
  onDeleted,
}: ProductDeleteDialogProps) {
  const t = useTranslations("bibliotheque");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens for a new product; skip reset while deleting.
  useEffect(() => {
    if (!isDeleting) {
      setConfirmText("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, open]);

  if (!product) return null;

  const handleDelete = async () => {
    if (confirmText.trim() !== product.name) return;

    setIsDeleting(true);
    setError(null);

    const result = await deleteProductAction(product.id);
    if (!result.ok) {
      setError(result.error);
      if (result.error.includes("permission")) toast.error(t("toast.forbidden"));
      else toast.error(t("toast.deleteError"));
      setIsDeleting(false);
      return;
    }

    toast.success(t("toast.deleted"));
    await onDeleted(product.id);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isDeleting && onOpenChange(o)}>
      <AlertDialogContent className="max-w-sm sm:max-w-md">
        {/* Header — centered icon over negative-tint circle, then title + product name */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--negative-tint)" }}
          >
            <Trash2 size={20} style={{ color: "var(--negative)" }} />
          </div>
          <div className="space-y-1 text-center">
            <AlertDialogTitle className="font-display text-center">
              {t("deleteTitle")}
            </AlertDialogTitle>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {product.name}
            </p>
          </div>
        </div>

        {/* Warning body — purchase count included via ICU plural */}
        <div className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
          <p style={{ color: "var(--negative)" }}>
            {t("deleteWarning", { name: product.name, count: product.purchase_count })}
          </p>
        </div>

        {/* Typed confirmation */}
        <div className="space-y-2">
          <Label htmlFor="delete-product-confirm">
            {t("deleteConfirmLabel")} <strong>{product.name}</strong>
          </Label>
          <Input
            id="delete-product-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={product.name}
            disabled={isDeleting}
            autoComplete="off"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <AlertDialogFooter className="gap-2 sm:justify-center">
          <AlertDialogCancel disabled={isDeleting}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={confirmText.trim() !== product.name || isDeleting}
            style={{ background: "var(--negative)", color: "white" }}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("actions.delete")}
              </>
            ) : (
              t("actions.delete")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
