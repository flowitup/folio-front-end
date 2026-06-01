"use client";

/**
 * ProductCard — card view for a single library product.
 *
 * Displays the product photo (self-fetched by ProductImage),
 * name, description, badges (supplier, category, size), and footer with
 * purchase stats and link to the supplier's product page.
 */

import { useTranslations } from "next-intl";
import { ExternalLink, Check } from "lucide-react";
import { ProductImage } from "@/components/bibliotheque/product-image";
import { cn } from "@/lib/utils";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";
import { formatDate } from "@/lib/utils/formatters";

interface ProductCardProps {
  product: LibraryProduct;
  /** Map from supplier_id → Supplier, pre-fetched by the page. */
  suppliersById: Record<string, Supplier>;
  /** When true the card click selects for comparison instead of opening detail. */
  compareMode?: boolean;
  /** Whether this card is currently picked for comparison. */
  selected?: boolean;
  onClick: () => void;
}

export function ProductCard({
  product,
  suppliersById,
  compareMode = false,
  selected = false,
  onClick,
}: ProductCardProps) {
  const t = useTranslations("bibliotheque");

  const supplier = suppliersById[product.supplier_id];

  const lastPurchased = product.last_purchased_at
    ? formatDate(product.last_purchased_at)
    : null;

  return (
    <article
      className={cn(
        "folio-card relative flex cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md",
        selected && "ring-2 ring-[var(--accent)]"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={product.name}
      aria-pressed={compareMode ? selected : undefined}
    >
      {/* Selected badge — only shown while picking for comparison */}
      {compareMode && selected && (
        <span
          className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white shadow"
          style={{ background: "var(--accent)" }}
          aria-hidden
        >
          <Check size={14} strokeWidth={3} />
        </span>
      )}

      {/* Photo */}
      <ProductImage
        productId={product.id}
        hasImage={product.has_image}
        alt={product.name}
        className="w-full"
      />

      {/* Body — compact stack that stays readable in the 5-column desktop grid. */}
      <div className="flex flex-1 flex-col p-3">
        {/* Name */}
        <h3 className="mb-1 line-clamp-2 font-display text-[13.5px] font-medium leading-snug tracking-tight">
          {product.name}
        </h3>

        {/* Description — single line to avoid crowding dense cards. */}
        {product.description && (
          <p
            className="mb-2 line-clamp-1 text-[12px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {product.description}
          </p>
        )}

        {/* Badges — wrap gracefully; smaller stamps at high density. */}
        <div className="mb-2.5 flex flex-wrap gap-1">
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

        {/* Footer — purchase stats + icon-only outbound link to save width. */}
        <div
          className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-[11.5px]"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="min-w-0 truncate" style={{ color: "var(--muted)" }}>
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
              aria-label={t("viewProduct")}
              title={t("viewProduct")}
              className="shrink-0 transition-colors hover:text-[var(--accent)]"
              style={{ color: "var(--ink-2)" }}
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
