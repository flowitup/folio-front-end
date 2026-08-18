"use client";

/**
 * Optional bibliothèque picker for a quote: choose a fournisseur, then search
 * that supplier's catalogue.
 *
 * The catalogue can be large, so products are searched server-side (debounced,
 * paginated) — never preloaded. Degrades to plain free text when the project is
 * not attached to a company, since `projects.company_id` is still nullable and
 * there would be no catalogue to search.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listProductsAction,
  listSuppliersAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import type { LibraryProduct, Supplier } from "@/lib/api/bibliotheque";

export interface PickedProduct {
  supplierId: string | null;
  supplierName: string;
  productId: string | null;
  productName: string;
  productUrl: string | null;
  /** Last purchase price, offered as a starting point — not authoritative. */
  suggestedPrice: string | null;
}

interface Props {
  companyId: string | null;
  onPick: (picked: PickedProduct) => void;
}

const DEBOUNCE_MS = 300;

export function SupplierProductPicker({ companyId, onPick }: Props) {
  const t = useTranslations("chiffrage");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LibraryProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void listSuppliersAction(companyId).then((res) => {
      if (!cancelled && res.ok) setSuppliers(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const search = useCallback(
    (q: string, supplier: string) => {
      if (!companyId) return;
      setSearching(true);
      void listProductsAction(companyId, {
        q: q || undefined,
        supplier: supplier || undefined,
        page: 1,
      }).then((res) => {
        setSearching(false);
        setResults(res.ok ? res.data.items.slice(0, 8) : []);
      });
    },
    [companyId]
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => search(value.trim(), supplierId), DEBOUNCE_MS);
  };

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  if (!companyId) return null;

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3" data-testid="supplier-product-picker">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("pickFromLibrary")}
      </p>

      <select
        value={supplierId}
        onChange={(e) => {
          setSupplierId(e.target.value);
          if (query.trim().length >= 2) search(query.trim(), e.target.value);
        }}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        aria-label={t("supplier")}
      >
        <option value="">{t("allSuppliers")}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          placeholder={t("searchProducts")}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-8"
        />
        {searching ? <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin" /> : null}
      </div>

      {results.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-1.5 text-left"
                onClick={() =>
                  onPick({
                    supplierId: p.supplier_id,
                    supplierName: supplierName(p.supplier_id) || supplierName(supplierId),
                    productId: p.id,
                    productName: p.name,
                    productUrl: p.product_url,
                    suggestedPrice: p.last_unit_price,
                  })
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.supplier_reference}
                    {p.last_unit_price ? ` · ${p.last_unit_price} €` : ""}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {query.trim().length >= 2 && !searching && results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("noProductsFound")}</p>
      ) : null}
    </div>
  );
}
