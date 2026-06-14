"use client";

/**
 * ProductCreateDialog — modal for adding a new library product.
 *
 * Supports picking an existing supplier from the company's list OR creating a
 * new one inline (name + optional website). Includes optional image upload
 * after product creation (non-fatal: product is kept even if image upload fails).
 *
 * Supplier choice: if suppliers.length === 0, defaults to "new" mode.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProductAction,
  uploadProductImageAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { LIBRARY_CATEGORY_SLUGS, localizeCategory } from "@/lib/bibliotheque/categories";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

// Sentinel value for the "no category" option in the Select component.
// shadcn Select does not allow value="" for an item, so we use a sentinel.
const NO_CATEGORY_SENTINEL = "__none__";

interface ProductCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  suppliers: Supplier[];
  onCreated: (product: LibraryProduct) => void | Promise<void>;
}

export function ProductCreateDialog({
  open,
  onOpenChange,
  companyId,
  suppliers,
  onCreated,
}: ProductCreateDialogProps) {
  const t = useTranslations("bibliotheque");

  // Supplier mode: "existing" or "new"
  const defaultMode = suppliers.length === 0 ? "new" : "existing";
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">(defaultMode);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierWebsite, setSupplierWebsite] = useState("");

  // Product fields
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY_SENTINEL);
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      const mode = suppliers.length === 0 ? "new" : "existing";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupplierMode(mode);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupplierId("");
      setSupplierName("");
      setSupplierWebsite("");
      setName("");
      setReference("");
      setCategory(NO_CATEGORY_SENTINEL);
      setSize("");
      setDescription("");
      setProductUrl("");
      setImageFile(null);
      setImagePreviewUrl(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, suppliers.length]);

  // Revoke object URL on cleanup to avoid memory leaks
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isSubmitting) onOpenChange(isOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("validation.nameRequired"));
      return;
    }

    // Validate supplier choice
    if (supplierMode === "existing" && !supplierId) {
      setError(t("validation.supplierRequired"));
      return;
    }
    if (supplierMode === "new" && !supplierName.trim()) {
      setError(t("validation.supplierRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Build payload — exactly one of supplier_id / supplier_name
    const payload = {
      name: trimmedName,
      ...(supplierMode === "existing"
        ? { supplier_id: supplierId }
        : {
            supplier_name: supplierName.trim(),
            ...(supplierWebsite.trim() ? { supplier_website_url: supplierWebsite.trim() } : {}),
          }),
      ...(reference.trim() ? { supplier_reference: reference.trim() } : {}),
      category: category === NO_CATEGORY_SENTINEL ? null : category,
      ...(size.trim() ? { size: size.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(productUrl.trim() ? { product_url: productUrl.trim() } : {}),
    };

    const result = await createProductAction(companyId, payload);
    if (!result.ok) {
      setError(result.error);
      if (result.error.includes("permission")) toast.error(t("toast.forbidden"));
      else toast.error(t("toast.createError"));
      setIsSubmitting(false);
      return;
    }

    const created = result.data;

    // Non-fatal image upload after product creation
    if (imageFile) {
      const fd = new FormData();
      fd.append("image", imageFile);
      const imgResult = await uploadProductImageAction(created.id, fd);
      if (!imgResult.ok) {
        toast.warning(t("toast.imageUploadWarning"));
      }
    }

    toast.success(t("toast.created"));
    await onCreated(created);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Supplier mode toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={supplierMode === "existing" ? "default" : "outline"}
              onClick={() => setSupplierMode("existing")}
              disabled={suppliers.length === 0 || isSubmitting}
            >
              {t("supplierMode.existing")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={supplierMode === "new" ? "default" : "outline"}
              onClick={() => setSupplierMode("new")}
              disabled={isSubmitting}
            >
              {t("supplierMode.new")}
            </Button>
          </div>

          {/* Supplier picker / new supplier fields */}
          {supplierMode === "existing" ? (
            <div className="space-y-2">
              <Label>{t("supplier")}</Label>
              <Select
                value={supplierId}
                onValueChange={setSupplierId}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("allSuppliers")} />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="create-supplier-name">{t("fields.supplierName")}</Label>
                <Input
                  id="create-supplier-name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  maxLength={255}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-supplier-website">{t("fields.supplierWebsite")}</Label>
                <Input
                  id="create-supplier-website"
                  value={supplierWebsite}
                  onChange={(e) => setSupplierWebsite(e.target.value)}
                  placeholder="https://"
                  maxLength={500}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {/* Product name */}
          <div className="space-y-2">
            <Label htmlFor="create-product-name">{t("fields.name")}</Label>
            <Input
              id="create-product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={1000}
              required
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* SKU / Reference */}
          <div className="space-y-2">
            <Label htmlFor="create-product-reference">{t("fields.reference")}</Label>
            <Input
              id="create-product-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={200}
              disabled={isSubmitting}
            />
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("fields.referenceHint")}
            </p>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>{t("fields.category")}</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY_SENTINEL}>
                  {t("uncategorizedOption")}
                </SelectItem>
                {LIBRARY_CATEGORY_SLUGS.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {localizeCategory(slug, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="space-y-2">
            <Label htmlFor="create-product-size">{t("fields.size")}</Label>
            <Input
              id="create-product-size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="create-product-description">{t("fields.description")}</Label>
            <Textarea
              id="create-product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Product URL */}
          <div className="space-y-2">
            <Label htmlFor="create-product-url">{t("fields.productUrl")}</Label>
            <Input
              id="create-product-url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://"
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label htmlFor="create-product-image">{t("fields.image")}</Label>
            <input
              ref={fileInputRef}
              id="create-product-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("fields.imageHint")}
            </p>
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="mt-2 h-32 w-auto rounded-md object-contain"
              />
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={isSubmitting}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("actions.create")}
                </>
              ) : (
                t("actions.create")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
