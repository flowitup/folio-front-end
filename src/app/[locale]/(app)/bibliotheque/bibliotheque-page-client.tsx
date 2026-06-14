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

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Loader2, BookOpen, Scale, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProductFilterBar } from "@/components/bibliotheque/product-filter-bar";
import { ProductCard } from "@/components/bibliotheque/product-card";
import { ProductDetailDialog } from "@/components/bibliotheque/product-detail-dialog";
import { ProductCreateDialog } from "@/components/bibliotheque/product-create-dialog";
import { ProductEditDialog } from "@/components/bibliotheque/product-edit-dialog";
import { ProductDeleteDialog } from "@/components/bibliotheque/product-delete-dialog";
import { CompareBar } from "@/components/bibliotheque/compare-bar";
import { ProductCompareDialog } from "@/components/bibliotheque/product-compare-dialog";
import { LibraryPagination } from "@/components/bibliotheque/library-pagination";
import {
  listSuppliersAction,
  listCategoriesAction,
  listProductsAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

const PAGE_SIZE = 24; // 12 rows of 2 / 8 of 3 / ~5 of 5 — fits every breakpoint
const MAX_COMPARE = 4; // side-by-side columns that fit the compare dialog

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

  // Mutation dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<LibraryProduct | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<LibraryProduct | null>(null);

  // Compare — session-only. Store full product rows (keyed by id) so selections
  // survive pagination/filter changes even when a picked product leaves the
  // current page; list rows already carry every field the comparison needs.
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, LibraryProduct>>(new Map());
  const [compareOpen, setCompareOpen] = useState(false);

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

  // Fetch counter used by reload() to trigger useEffect re-run without changing filters
  const [fetchTick, setFetchTick] = useState(0);

  /**
   * Reload the product list from the current filter/page state.
   * Call after any mutation (create/update/delete) to reflect changes.
   *
   * Note: newly created manual products have null last_purchased_at and sort
   * LAST in the default NULLS-last ordering. After create, reload() shows the
   * current page — the new product may appear on a later page. A future
   * "sort by created_at" option would surface it immediately (out of scope v1).
   */
  const reload = useCallback(() => {
    setFetchTick((n) => n + 1);
  }, []);

  // Load products when filters / page change (or reload() is called)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, supplier, category, debouncedQ, page, fetchTick]);

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

  // Compare handlers
  const toggleCompareMode = () => {
    setCompareMode((on) => {
      if (on) setSelected(new Map()); // leaving compare mode clears the picks
      return !on;
    });
  };

  const toggleSelect = (product: LibraryProduct) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
      } else {
        if (next.size >= MAX_COMPARE) {
          toast.error(t("compareMax", { count: MAX_COMPARE }));
          return prev;
        }
        next.set(product.id, product);
      }
      return next;
    });
  };

  const removeFromCompare = (id: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(id);
      if (next.size < 2) setCompareOpen(false); // need ≥2 to compare
      return next;
    });
  };

  const clearSelection = () => setSelected(new Map());

  const selectedProducts = Array.from(selected.values());

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="fade-up px-4 pb-12 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("subtitle")}
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
          {t("addProduct")}
        </Button>
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
        <Button
          variant={compareMode ? "default" : "outline"}
          size="sm"
          className="shrink-0 gap-1.5"
          aria-pressed={compareMode}
          onClick={toggleCompareMode}
        >
          <Scale className="h-4 w-4" />
          {t("compare")}
        </Button>
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
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                suppliersById={suppliersById}
                compareMode={compareMode}
                selected={selected.has(product.id)}
                onClick={() =>
                  compareMode ? toggleSelect(product) : openProduct(product.id)
                }
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <LibraryPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Product detail dialog */}
      <ProductDetailDialog
        productId={selectedProductId}
        suppliersById={suppliersById}
        onClose={closeProduct}
        onEdit={(p) => {
          // Close detail before opening edit to avoid two stacked modals
          closeProduct();
          setEditProduct(p);
        }}
        onDelete={(p) => {
          closeProduct();
          setDeleteProduct(p);
        }}
      />

      {/* Create product dialog */}
      <ProductCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
        suppliers={suppliers}
        onCreated={() => {
          reload();
        }}
      />

      {/* Edit product dialog */}
      <ProductEditDialog
        product={editProduct}
        open={editProduct !== null}
        onOpenChange={(open) => { if (!open) setEditProduct(null); }}
        onUpdated={() => {
          setEditProduct(null);
          reload();
        }}
      />

      {/* Delete product dialog */}
      <ProductDeleteDialog
        product={deleteProduct}
        open={deleteProduct !== null}
        onOpenChange={(open) => { if (!open) setDeleteProduct(null); }}
        onDeleted={() => {
          setDeleteProduct(null);
          reload();
        }}
      />

      {/* Floating compare bar — only while selecting */}
      {compareMode && selected.size > 0 && (
        <CompareBar
          count={selected.size}
          canCompare={selected.size >= 2}
          onClear={clearSelection}
          onCompare={() => setCompareOpen(true)}
        />
      )}

      {/* Comparison dialog */}
      <ProductCompareDialog
        open={compareOpen}
        products={selectedProducts}
        suppliersById={suppliersById}
        onRemove={removeFromCompare}
        onClose={() => setCompareOpen(false)}
      />
    </div>
  );
}
