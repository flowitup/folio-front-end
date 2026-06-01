"use client";

/**
 * ProductCompareDialog — side-by-side comparison of 2–4 library products.
 *
 * First column holds attribute labels; one column per selected product. The
 * cheapest non-null last unit price is highlighted so the user can spot the
 * best deal at a glance. Each product column can be removed in place; dropping
 * below 2 products closes the dialog (handled by the parent's onRemove).
 *
 * No network calls — the parent passes already-fetched LibraryProduct rows.
 * Price/date formatting mirrors product-detail-dialog.tsx.
 */

import type { ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductImage } from "@/components/bibliotheque/product-image";
import { cn } from "@/lib/utils";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

interface ProductCompareDialogProps {
  open: boolean;
  products: LibraryProduct[];
  suppliersById: Record<string, Supplier>;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function ProductCompareDialog({
  open,
  products,
  suppliersById,
  onRemove,
  onClose,
}: ProductCompareDialogProps) {
  const t = useTranslations("bibliotheque");
  const locale = useLocale();

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));

  const fmtPrice = (val: string) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
    }).format(parseFloat(val));

  // Cheapest non-null last unit price across the set (for highlighting).
  const prices = products
    .map((p) => (p.last_unit_price != null ? parseFloat(p.last_unit_price) : null))
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

  // Attribute rows — config array keeps the table DRY.
  const rows: { key: string; label: string; render: (p: LibraryProduct) => ReactNode }[] = [
    {
      key: "supplier",
      label: t("supplier"),
      render: (p) => suppliersById[p.supplier_id]?.name ?? "—",
    },
    {
      key: "category",
      label: t("category"),
      render: (p) => p.category ?? t("uncategorized"),
    },
    {
      key: "size",
      label: t("size"),
      render: (p) => p.size ?? "—",
    },
    {
      key: "lastUnitPrice",
      label: t("lastUnitPrice"),
      render: (p) => {
        if (p.last_unit_price == null) return "—";
        const val = parseFloat(p.last_unit_price);
        const isCheapest = minPrice != null && val === minPrice;
        return isCheapest ? (
          <span className="stamp positive">{fmtPrice(p.last_unit_price)}</span>
        ) : (
          <span className="num">{fmtPrice(p.last_unit_price)}</span>
        );
      },
    },
    {
      key: "purchased",
      label: t("purchaseHistory"),
      render: (p) => t("purchasedTimes", { count: p.purchase_count }),
    },
    {
      key: "lastPurchased",
      label: t("lastPurchased"),
      render: (p) => (p.last_purchased_at ? fmtDate(p.last_purchased_at) : "—"),
    },
    {
      key: "link",
      label: t("viewProduct"),
      render: (p) =>
        p.product_url ? (
          <a
            href={p.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium hover:text-[var(--accent)]"
          >
            {t("viewProduct")}
            <ExternalLink size={11} />
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-[18px] tracking-tight">
            {t("compareTitle")}
          </DialogTitle>
        </DialogHeader>

        {products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {/* Empty top-left corner above the label column */}
                  <th className="w-32 align-bottom" />
                  {products.map((p) => (
                    <th key={p.id} className="min-w-[160px] p-2 align-top">
                      <div className="relative flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          aria-label={t("removeFromCompare")}
                          title={t("removeFromCompare")}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-[var(--paper)] hover:text-[var(--negative)]"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <X size={12} />
                        </button>
                        <ProductImage
                          productId={p.id}
                          hasImage={p.has_image}
                          alt={p.name}
                          className="aspect-square w-20 rounded-md"
                        />
                        <span className="line-clamp-2 text-center font-display text-[13px] font-medium leading-snug">
                          {p.name}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td
                      className="label-cap whitespace-nowrap py-2.5 pr-3 align-top"
                      style={{ color: "var(--muted)" }}
                    >
                      {row.label}
                    </td>
                    {products.map((p) => (
                      <td
                        key={p.id}
                        className={cn("py-2.5 px-2 text-center align-top")}
                      >
                        {row.render(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
