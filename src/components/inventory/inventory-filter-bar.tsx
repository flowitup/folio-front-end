"use client";

/**
 * InventoryFilterBar — search input, place select, condition select and an
 * optional warehouse select. Pure controlled component; the parent debounces
 * the search and applies the filters locally (the whole company inventory is
 * loaded at once, it stays in the hundreds).
 */

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import type { Warehouse } from "@/lib/api/inventory";

export type LocationFilter = "" | "warehouse" | "site";
export type ConditionFilter = "" | "working" | "damaged";

interface FilterBarProps {
  warehouses: Warehouse[];
  location: LocationFilter;
  condition: ConditionFilter;
  warehouseId: string;
  search: string;
  onLocationChange: (v: LocationFilter) => void;
  onConditionChange: (v: ConditionFilter) => void;
  onWarehouseChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export function InventoryFilterBar({
  warehouses,
  location,
  condition,
  warehouseId,
  search,
  onLocationChange,
  onConditionChange,
  onWarehouseChange,
  onSearchChange,
}: FilterBarProps) {
  const t = useTranslations("inventory");

  return (
    <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
      <select
        className="folio-input sm:w-44"
        value={location}
        onChange={(e) => onLocationChange(e.target.value as LocationFilter)}
        aria-label={t("fields.location")}
      >
        <option value="">{t("filters.everywhere")}</option>
        <option value="warehouse">{t("location.warehouse")}</option>
        <option value="site">{t("location.site")}</option>
      </select>

      <select
        className="folio-input sm:w-44"
        value={condition}
        onChange={(e) => onConditionChange(e.target.value as ConditionFilter)}
        aria-label={t("fields.condition")}
      >
        <option value="">{t("filters.anyCondition")}</option>
        <option value="working">{t("condition.working")}</option>
        <option value="damaged">{t("condition.damaged")}</option>
      </select>

      {warehouses.length > 0 && location !== "site" && (
        <select
          className="folio-input sm:w-48"
          value={warehouseId}
          onChange={(e) => onWarehouseChange(e.target.value)}
          aria-label={t("fields.warehouse")}
        >
          <option value="">{t("filters.allWarehouses")}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      <div className="relative flex-1">
        <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--muted)" }} />
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
