"use client";

/**
 * ProductDetailDialog — modal detail view for a library product.
 *
 * Opened via the ?product=<id> deep-link strategy (push on open, replace on
 * close) to match the invoices page URL pattern. Fetches the full product
 * detail (including purchase history) via a server action on mount.
 *
 * Purchase history table is sorted purchased_at DESC as required.
 * Image uses the presigned URL fetched alongside the detail response.
 */

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/bibliotheque/product-image";
import {
  getProductAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { ProductDetailResult, Supplier } from "@/lib/api/bibliotheque";
import { formatDate } from "@/lib/utils/formatters";
import { localizeCategory } from "@/lib/bibliotheque/categories";

interface ProductDetailDialogProps {
  productId: string | null;
  suppliersById: Record<string, Supplier>;
  onClose: () => void;
  /** Called when the user clicks Edit; caller should close detail + open edit dialog. */
  onEdit?: (product: import("@/lib/api/bibliotheque").LibraryProduct) => void;
  /** Called when the user clicks Delete; caller should close detail + open delete dialog. */
  onDelete?: (product: import("@/lib/api/bibliotheque").LibraryProduct) => void;
}

export function ProductDetailDialog({
  productId,
  suppliersById,
  onClose,
  onEdit,
  onDelete,
}: ProductDetailDialogProps) {
  const t = useTranslations("bibliotheque");
  const locale = useLocale();

  const [detail, setDetail] = useState<ProductDetailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setDetail(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setError(null);

    async function load() {
      try {
        const detailRes = await getProductAction(productId!);
        if (cancelled) return;

        if (!detailRes.ok) {
          setError(detailRes.error);
          return;
        }
        setDetail(detailRes.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [productId]);

  const fmtDate = (iso: string) => formatDate(iso);

  const fmtPrice = (val: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(parseFloat(val));

  const product = detail?.product;
  const supplier = product ? suppliersById[product.supplier_id] : undefined;

  // Purchase history sorted purchased_at DESC
  const purchases = detail
    ? [...detail.purchases].sort(
        (a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
      )
    : [];

  return (
    <Dialog open={!!productId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[18px] tracking-tight">
            {product ? product.name : t("detailTitle")}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted)" }} />
          </div>
        )}

        {error && !loading && (
          <div className="py-4 text-center text-[13px]" style={{ color: "var(--negative)" }}>
            {error}
          </div>
        )}

        {product && !loading && (
          <div className="space-y-5">
            {/* Footer actions — Edit + Delete. Permissions are enforced by the BE;
                a 403 from the action surfaces as a toast.forbidden message (S2). */}
            {(onEdit ?? onDelete) && (
              <div className="flex justify-end gap-2 border-b pb-4" style={{ borderColor: "var(--line)" }}>
                {onEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onEdit(product)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("editTitle")}
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    style={{ color: "var(--negative)", borderColor: "var(--negative)" }}
                    onClick={() => onDelete(product)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("deleteTitle")}
                  </Button>
                )}
              </div>
            )}
            {/* Image */}
            <ProductImage
              productId={product.id}
              hasImage={product.has_image}
              alt={product.name}
              className="w-full rounded-lg"
            />

            {/* Meta */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
              {supplier && (
                <div>
                  <div className="label-cap mb-0.5">{t("supplier")}</div>
                  {supplier.website_url ? (
                    <a
                      href={supplier.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium hover:text-[var(--accent)]"
                    >
                      {supplier.name}
                      <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span className="font-medium">{supplier.name}</span>
                  )}
                </div>
              )}

              {product.category && (
                <div>
                  <div className="label-cap mb-0.5">{t("category")}</div>
                  <span className="font-medium">{localizeCategory(product.category, t)}</span>
                </div>
              )}

              {product.size && (
                <div>
                  <div className="label-cap mb-0.5">{t("size")}</div>
                  <span className="font-medium">{product.size}</span>
                </div>
              )}

              {product.product_url && (
                <div>
                  <div className="label-cap mb-0.5">{t("viewProduct")}</div>
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium hover:text-[var(--accent)]"
                  >
                    {t("viewProduct")}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {product.description}
              </p>
            )}

            {/* Purchase history */}
            {purchases.length > 0 && (
              <div>
                <div className="label-cap mb-3">{t("purchaseHistory")}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr
                        className="border-b text-left"
                        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                      >
                        <th className="pb-2 pr-4 font-medium">{t("date")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("sourceRef")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("documentType.ticket")}/{t("documentType.commande")}</th>
                        <th className="pb-2 pr-4 font-medium num">{t("quantity")}</th>
                        <th className="pb-2 font-medium num">{t("unitPrice")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.map((p, i) => (
                        <tr
                          key={`${p.source_document_ref}-${p.line_index}-${i}`}
                          className="border-b"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <td className="py-2 pr-4">{fmtDate(p.purchased_at)}</td>
                          <td className="py-2 pr-4 font-mono text-[11px]">
                            {p.source_document_ref}
                          </td>
                          <td className="py-2 pr-4">
                            <span className={p.source_document_type === "ticket" ? "stamp" : "stamp accent"}>
                              {t(`documentType.${p.source_document_type}`)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 num">{p.quantity}</td>
                          <td className="py-2 num">{fmtPrice(p.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
