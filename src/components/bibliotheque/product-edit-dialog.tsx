"use client";

/**
 * ProductEditDialog — modal for editing a library product.
 *
 * Editable fields: name, category, size, description, product_url.
 * Supplier and reference are shown read-only for context but cannot be changed.
 *
 * Diff payload: only changed keys are sent to the BE (PATCH with model_fields_set).
 * Cleared optional fields are sent as null. Unchanged fields are omitted.
 * Submit is disabled if there are no changes (no diff AND no new image chosen).
 *
 * Image: shows current image via ProductImage; file input replaces it with
 * uploadProductImageAction using force:true. Image failure is non-fatal.
 *
 * Image from a supplier link: "Fetch" has the server download it right away
 * (force:true) and shows the new picture — the supplier CDNs block the
 * browser, so there is no local preview to show first. A link typed but not
 * fetched is applied on Save like a chosen file. File and link replace each
 * other: the last one picked wins.
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
import { ImageUrlField } from "@/components/ui/image-url-field";
import {
  setProductImageFromUrlAction,
  updateProductAction,
  uploadProductImageAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { LIBRARY_CATEGORY_SLUGS, localizeCategory } from "@/lib/bibliotheque/categories";
import {
  MAX_PRODUCT_IMAGE_BYTES,
  imageUrlErrorKey,
  isHttpsUrl,
} from "@/lib/bibliotheque/image-url";
import { ProductImage } from "@/components/bibliotheque/product-image";
import type { LibraryProduct, UpdateProductPayload } from "@/lib/api/bibliotheque";

// Sentinel for "no category" in Select — shadcn does not allow value="".
const NO_CATEGORY_SENTINEL = "__none__";

interface ProductEditDialogProps {
  product: LibraryProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (product: LibraryProduct) => void | Promise<void>;
  /** Resolved supplier display name. Falls back to raw supplier_id when absent. */
  supplierName?: string;
  /**
   * The stored image was replaced from a link. The change is already saved,
   * so the list should refresh even if the dialog is then cancelled.
   */
  onImageChanged?: () => void;
}

export function ProductEditDialog({
  product,
  open,
  onOpenChange,
  onUpdated,
  supplierName,
  onImageChanged,
}: ProductEditDialogProps) {
  const t = useTranslations("bibliotheque");

  // Form state — hydrated from product when dialog opens
  const [name, setName] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY_SENTINEL);
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");

  // Original values — used to compute diff payload
  const [origName, setOrigName] = useState("");
  const [origCategory, setOrigCategory] = useState(NO_CATEGORY_SENTINEL);
  const [origSize, setOrigSize] = useState("");
  const [origDescription, setOrigDescription] = useState("");
  const [origProductUrl, setOrigProductUrl] = useState("");

  // Image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image from a supplier link
  const [imageUrl, setImageUrl] = useState("");
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  // Local copies so a fetched image shows at once, without waiting for the parent.
  const [hasImage, setHasImage] = useState(false);
  const [imageVersion, setImageVersion] = useState<string | undefined>(undefined);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = isSubmitting || isFetchingUrl;

  // Hydrate form from product when dialog opens or when product changes
  useEffect(() => {
    if (open && product) {
      const cat = product.category ?? NO_CATEGORY_SENTINEL;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(product.name);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategory(cat);
      setSize(product.size ?? "");
      setDescription(product.description ?? "");
      setProductUrl(product.product_url ?? "");
      setOrigName(product.name);
      setOrigCategory(cat);
      setOrigSize(product.size ?? "");
      setOrigDescription(product.description ?? "");
      setOrigProductUrl(product.product_url ?? "");
      setImageFile(null);
      setImagePreviewUrl(null);
      setImageUrl("");
      setImageUrlError(null);
      setIsFetchingUrl(false);
      setHasImage(product.has_image);
      setImageVersion(product.updated_at);
      setError(null);
      setIsSubmitting(false);
    }
  }, [product?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  if (!product) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && file.size > MAX_PRODUCT_IMAGE_BYTES) {
      toast.error(t("imageUrl.errors.tooLarge"));
      e.target.value = "";
      return;
    }
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
    if (file) {
      setImageUrl("");
      setImageUrlError(null);
    }
  };

  const handleImageUrlChange = (value: string) => {
    setImageUrl(value);
    setImageUrlError(null);
    // A link replaces a file chosen earlier (the preview URL is revoked by its effect).
    if (value.trim() && imageFile) {
      setImageFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const imageUrlErrorText = (code?: string) =>
    t(`imageUrl.errors.${imageUrlErrorKey(code)}`);

  /** Download the linked image now, replacing the stored one. */
  const handleFetchImageUrl = async () => {
    const url = imageUrl.trim();
    if (!url || busy) return;
    if (!isHttpsUrl(url)) {
      setImageUrlError(t("imageUrl.errors.invalid"));
      return;
    }
    setIsFetchingUrl(true);
    setImageUrlError(null);
    const result = await setProductImageFromUrlAction(product.id, url, { force: true });
    setIsFetchingUrl(false);
    if (!result.ok) {
      setImageUrlError(imageUrlErrorText(result.code));
      return;
    }
    setImageUrl("");
    setHasImage(true);
    setImageVersion(String(Date.now()));
    toast.success(t("imageUrl.fetched"));
    onImageChanged?.();
  };

  const handleClose = (isOpen: boolean) => {
    if (!busy) onOpenChange(isOpen);
  };

  /** Compute diff payload — only send changed keys to the BE. */
  function buildDiff(): UpdateProductPayload {
    const diff: UpdateProductPayload = {};

    if (name.trim() !== origName) diff.name = name.trim();

    // Category: sentinel → null (clear); changed slug → new slug
    const newCat = category === NO_CATEGORY_SENTINEL ? null : category;
    const oldCat = origCategory === NO_CATEGORY_SENTINEL ? null : origCategory;
    if (newCat !== oldCat) diff.category = newCat;

    // Optional string fields: empty string → null (clear)
    const newSize = size.trim() || null;
    const oldSize = origSize.trim() || null;
    if (newSize !== oldSize) diff.size = newSize;

    const newDesc = description.trim() || null;
    const oldDesc = origDescription.trim() || null;
    if (newDesc !== oldDesc) diff.description = newDesc;

    const newUrl = productUrl.trim() || null;
    const oldUrl = origProductUrl.trim() || null;
    if (newUrl !== oldUrl) diff.product_url = newUrl;

    return diff;
  }

  const diff = buildDiff();
  const hasDiff = Object.keys(diff).length > 0;
  const pendingImageUrl = imageUrl.trim();
  const hasImageChange = imageFile !== null || pendingImageUrl.length > 0;
  const canSubmit = (hasDiff || hasImageChange) && !busy && name.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (pendingImageUrl && !isHttpsUrl(pendingImageUrl)) {
      setImageUrlError(t("imageUrl.errors.invalid"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Only call PATCH if there are field changes (skip if only image changed)
    let updated = product;
    if (hasDiff) {
      const result = await updateProductAction(product.id, diff);
      if (!result.ok) {
        setError(result.error);
        if (result.code === "Forbidden") toast.error(t("toast.forbidden"));
        else toast.error(t("toast.updateError"));
        setIsSubmitting(false);
        return;
      }
      updated = result.data;
    }

    // Non-fatal image upload with force=true to overwrite existing image
    if (hasImageChange && imageFile) {
      const fd = new FormData();
      fd.append("image", imageFile);
      // A rejected call must not leave the dialog stuck on its spinner.
      const imgResult = await uploadProductImageAction(updated.id, fd, { force: true }).catch(
        () => ({ ok: false as const }),
      );
      if (!imgResult.ok) {
        toast.warning(t("toast.imageUploadWarning"));
      } else {
        // Optimistically mark has_image so detail/card renders the new image
        // immediately without waiting for the next full reload.
        updated = { ...updated, has_image: true };
      }
    } else if (pendingImageUrl) {
      // Non-fatal like the file upload; the reason goes in the toast.
      const urlResult = await setProductImageFromUrlAction(updated.id, pendingImageUrl, {
        force: true,
      });
      if (!urlResult.ok) {
        toast.warning(t("imageUrl.saveWarning"), {
          description: imageUrlErrorText(urlResult.code),
        });
      } else {
        updated = { ...updated, has_image: true };
      }
    }

    toast.success(t("toast.updated"));
    await onUpdated(updated);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Read-only supplier/reference context */}
          <div className="rounded-md p-3 text-[13px] space-y-1" style={{ background: "var(--paper-2)" }}>
            <div className="flex gap-4">
              <span style={{ color: "var(--muted)" }}>{t("supplier")}</span>
              <span className="font-medium">{supplierName ?? product.supplier_id}</span>
            </div>
            <div className="flex gap-4">
              <span style={{ color: "var(--muted)" }}>{t("fields.reference")}</span>
              <span className="font-mono text-[12px]">{product.supplier_reference}</span>
            </div>
          </div>

          {/* Product name */}
          <div className="space-y-2">
            <Label htmlFor="edit-product-name">{t("fields.name")}</Label>
            <Input
              id="edit-product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={1000}
              required
              autoFocus
              disabled={isSubmitting}
            />
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
            <Label htmlFor="edit-product-size">{t("fields.size")}</Label>
            <Input
              id="edit-product-size"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-product-description">{t("fields.description")}</Label>
            <Textarea
              id="edit-product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Product URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-product-url">{t("fields.productUrl")}</Label>
            <Input
              id="edit-product-url"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="https://"
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          {/* Image — show current + option to replace */}
          <div className="space-y-2">
            <Label htmlFor="edit-product-image">{t("fields.replaceImage")}</Label>
            {/* Current image (if any) */}
            {!imagePreviewUrl && (
              <ProductImage
                productId={product.id}
                hasImage={hasImage}
                version={imageVersion}
                alt={product.name}
                className="h-24 w-auto rounded-md object-contain"
              />
            )}
            <input
              ref={fileInputRef}
              id="edit-product-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={busy}
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
              {t("fields.imageHint")}
            </p>
            {imagePreviewUrl && (
              <img
                src={imagePreviewUrl}
                alt={t("imagePreviewAlt")}
                className="mt-2 h-32 w-auto rounded-md object-contain"
              />
            )}
          </div>

          {/* Image from a supplier link — fetched server-side */}
          <ImageUrlField
            id="edit-product-image-url"
            label={t("imageUrl.label")}
            value={imageUrl}
            onChange={handleImageUrlChange}
            placeholder={t("imageUrl.placeholder")}
            note={t("imageUrl.note")}
            error={imageUrlError}
            disabled={isSubmitting}
            fetchLabel={t("imageUrl.fetch")}
            onFetch={handleFetchImageUrl}
            fetching={isFetchingUrl}
          />

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={busy}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("actions.save")}
                </>
              ) : (
                t("actions.save")
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
