"use client";

/**
 * ProductFilterBar — supplier select, category select, and debounced search input.
 *
 * Notifies parent via onFilterChange on every committed change. Search is
 * debounced 300ms in the parent via useDebounce to avoid hammering the server
 * action on every keystroke.
 */

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { Supplier } from "@/lib/api/bibliotheque";

interface FilterBarProps {
  suppliers: Supplier[];
  categories: string[];
  supplier: string;
  category: string;
  search: string;
  onSupplierChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export function ProductFilterBar({
  suppliers,
  categories,
  supplier,
  category,
  search,
  onSupplierChange,
  onCategoryChange,
  onSearchChange,
}: FilterBarProps) {
  const t = useTranslations("bibliotheque");

  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      {/* Supplier select */}
      <select
        className="folio-input sm:w-48"
        value={supplier}
        onChange={(e) => onSupplierChange(e.target.value)}
        aria-label={t("supplier")}
      >
        <option value="">{t("allSuppliers")}</option>
        {suppliers.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Category select */}
      <select
        className="folio-input sm:w-48"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label={t("category")}
      >
        <option value="">{t("allCategories")}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Search */}
      <div className="relative flex-1">
        <Search
          size={14}
          style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }}
        />
        <input
          className="folio-input w-full"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ paddingLeft: 30 }}
        />
      </div>
    </div>
  );
}
