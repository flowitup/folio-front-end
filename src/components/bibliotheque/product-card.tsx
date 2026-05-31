"use client";

/**
 * ProductCard — card view for a single library product.
 *
 * Displays the product photo (self-fetched by ProductImage),
 * name, description, badges (supplier, category, size), and footer with
 * purchase stats and link to the supplier's product page.
 */

import { useTranslations, useLocale } from "next-intl";
import { ExternalLink } from "lucide-react";
import { ProductImage } from "@/components/bibliotheque/product-image";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

interface ProductCardProps {
  product: LibraryProduct;
  /** Map from supplier_id → Supplier, pre-fetched by the page. */
  suppliersById: Record<string, Supplier>;
  onClick: () => void;
}

export function ProductCard({
  product,
  suppliersById,
  onClick,
}: ProductCardProps) {
  const t = useTranslations("bibliotheque");
  const locale = useLocale();

  const supplier = suppliersById[product.supplier_id];

  const lastPurchased = product.last_purchased_at
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
        new Date(product.last_purchased_at)
      )
    : null;

  return (
    <article
      className="folio-card flex cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={product.name}
    >
      {/* Photo */}
      <ProductImage
        productId={product.id}
        hasImage={product.has_image}
        alt={product.name}
        className="w-full"
      />

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {/* Name */}
        <h3 className="mb-1 line-clamp-2 font-display text-[15px] font-medium leading-snug tracking-tight">
          {product.name}
        </h3>

        {/* Description */}
        {product.description && (
          <p
            className="mb-3 line-clamp-2 text-[12.5px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {product.description}
          </p>
        )}

        {/* Badges */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {supplier && (
            <span className="stamp">{supplier.name}</span>
          )}
          {product.category ? (
            <span className="stamp accent">{product.category}</span>
          ) : (
            <span className="stamp muted">{t("uncategorized")}</span>
          )}
          {product.size && (
            <span className="stamp positive">{product.size}</span>
          )}
        </div>

        {/* Footer */}
        <div
          className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11.5px]"
          style={{ borderColor: "var(--line)" }}
        >
          <div style={{ color: "var(--muted)" }}>
            <span className="num font-medium" style={{ color: "var(--ink)" }}>
              {t("purchasedTimes", { count: product.purchase_count })}
            </span>
            {lastPurchased && (
              <span className="ml-1">· {lastPurchased}</span>
            )}
          </div>

          {product.product_url && (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 font-medium transition-colors hover:text-[var(--accent)]"
              style={{ color: "var(--ink-2)" }}
            >
              {t("viewProduct")}
              <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
