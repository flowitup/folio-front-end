"use client";

/**
 * BibliothequePageClient — client-side library page.
 *
 * Receives the active company_id from the RSC shell (page.tsx) to avoid
 * re-fetching companies client-side. Loads suppliers, categories, and
 * products via server actions. Debounces search 300ms.
 *
 * Deep-link strategy for product detail: push on first open (none → some)
 * to add a back-button history entry; replace on swap/close to avoid
 * history pollution — mirrors the invoices page pattern.
 */

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2, BookOpen } from "lucide-react";
import { ProductFilterBar } from "@/components/bibliotheque/product-filter-bar";
import { ProductCard } from "@/components/bibliotheque/product-card";
import { ProductDetailDialog } from "@/components/bibliotheque/product-detail-dialog";
import {
  ProductDensityMenu,
  DEFAULT_COLUMNS,
  type ColumnCount,
} from "@/components/bibliotheque/product-density-menu";
import {
  listSuppliersAction,
  listCategoriesAction,
  listProductsAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

const PAGE_SIZE = 24; // divisible by 2/3/4/6/8 — even rows at every density

/**
 * Static Tailwind class strings per chosen wide-screen column count. Must be
 * literal (not interpolated) so Tailwind's compiler keeps them. Smaller
 * viewports auto-reduce: 2 cols (mobile) → 3 (sm) → 4 (lg) → chosen (xl).
 */
const COLUMN_CLASS_MAP: Record<ColumnCount, string> = {
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6",
  8: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8",
};

interface Props {
  companyId: string;
}

export function BibliothequePageClient({ companyId }: Props) {
  const t = useTranslations("bibliotheque");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);

  // Column density — session-only, defaults to the densest layout.
  const [columns, setColumns] = useState<ColumnCount>(DEFAULT_COLUMNS);

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [products, setProducts] = useState<LibraryProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deep-link: selected product id from ?product=<id>
  const selectedProductId = searchParams.get("product");

  const suppliersById = Object.fromEntries(suppliers.map((s) => [s.id, s]));

  // Debounce search input 300ms
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(v);
      setPage(1);
    }, 300);
  };

  // Reset page when filters change
  const handleSupplierChange = (v: string) => { setSupplier(v); setPage(1); };
  const handleCategoryChange = (v: string) => { setCategory(v); setPage(1); };

  // Load suppliers + categories once on mount
  useEffect(() => {
    async function loadMeta() {
      const [sRes, cRes] = await Promise.all([
        listSuppliersAction(companyId),
        listCategoriesAction(companyId),
      ]);
      if (sRes.ok) setSuppliers(sRes.data);
      if (cRes.ok) setCategories(cRes.data);
    }
    loadMeta();
  }, [companyId]);

  // Load products when filters / page change
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      const res = await listProductsAction(companyId, {
        supplier: supplier || undefined,
        category: category || undefined,
        q: debouncedQ || undefined,
        page,
      });
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setProducts(res.data.items);
      setTotal(res.data.total);
      setLoading(false);
      // Each ProductCard fetches its own image blob lazily (see ProductImage).
    }

    run();
    return () => { cancelled = true; };
  }, [companyId, supplier, category, debouncedQ, page]);

  // Deep-link helpers — mirror invoices page push/replace strategy
  const setSelectedProduct = (id: string | null, isInitialOpen: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("product", id);
    else params.delete("product");
    const qs = params.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (isInitialOpen) router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  };

  const openProduct = (id: string) => {
    setSelectedProduct(id, selectedProductId === null);
  };

  const closeProduct = () => setSelectedProduct(null, false);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="fade-up px-4 pb-12 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          {t("subtitle")}
        </p>
      </div>

      {/* Filter bar + density control */}
      <div className="mb-5 flex items-center gap-3">
        <ProductFilterBar
          suppliers={suppliers}
          categories={categories}
          supplier={supplier}
          category={category}
          search={searchInput}
          onSupplierChange={handleSupplierChange}
          onCategoryChange={handleCategoryChange}
          onSearchChange={handleSearchChange}
        />
        {/* Hidden below lg — small screens auto-reduce columns regardless. */}
        <div className="hidden lg:block">
          <ProductDensityMenu value={columns} onChange={setColumns} />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="folio-card p-6 text-center text-[13px]" style={{ color: "var(--negative)" }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <BookOpen size={36} style={{ color: "var(--muted)" }} />
          </div>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {t("noResults")}
          </p>
        </div>
      )}

      {/* Product grid */}
      {!loading && !error && products.length > 0 && (
        <>
          <div className={`grid gap-4 ${COLUMN_CLASS_MAP[columns]}`}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                suppliersById={suppliersById}
                onClick={() => openProduct(product.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </button>
              <span className="num text-[13px]" style={{ color: "var(--muted)" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {/* Product detail dialog */}
      <ProductDetailDialog
        productId={selectedProductId}
        suppliersById={suppliersById}
        onClose={closeProduct}
      />
    </div>
  );
}
