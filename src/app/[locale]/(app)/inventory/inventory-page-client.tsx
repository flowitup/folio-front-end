"use client";

/**
 * InventoryPageClient — the company equipment inventory: what the company
 * owns, how many, whether each is working or damaged, and where it is (a
 * warehouse with its address, or a site). Loads the whole company inventory
 * once and filters it locally; rows are grouped by place.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Plus, Warehouse as WarehouseIcon, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "@/context/ProjectContext";
import {
  listInventoryItemsAction,
  listWarehousesAction,
} from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import type { InventoryItem, Warehouse } from "@/lib/api/inventory";
import {
  groupInventoryByLocation,
  summarizeInventory,
  unitsByWarehouse,
  type SiteRef,
} from "@/lib/inventory/inventory";
import {
  InventoryFilterBar,
  type ConditionFilter,
  type LocationFilter,
} from "@/components/inventory/inventory-filter-bar";
import { InventorySummaryTiles } from "@/components/inventory/inventory-summary";
import { InventoryGroups } from "@/components/inventory/inventory-groups";
import { InventoryItemDialog } from "@/components/inventory/inventory-item-dialog";
import { InventoryItemDeleteDialog } from "@/components/inventory/inventory-item-delete-dialog";
import { WarehousesDialog } from "@/components/inventory/warehouses-dialog";

interface Props {
  companyId: string;
}

export function InventoryPageClient({ companyId }: Props) {
  const t = useTranslations("inventory");
  const { projects } = useProject();

  // Filters — applied locally on the loaded list.
  const [location, setLocation] = useState<LocationFilter>("");
  const [condition, setCondition] = useState<ConditionFilter>("");
  const [warehouseId, setWarehouseId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Data
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);
  const reload = useCallback(() => setFetchTick((n) => n + 1), []);

  // Dialogs
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [warehousesOpen, setWarehousesOpen] = useState(false);

  const handleSearchChange = (v: string) => {
    setSearchInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(v.trim()), 300);
  };

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      const [itemsRes, warehousesRes] = await Promise.all([
        listInventoryItemsAction(companyId),
        listWarehousesAction(companyId),
      ]);
      if (cancelled) return;
      if (!itemsRes.ok) {
        setError(itemsRes.error);
        setLoading(false);
        return;
      }
      if (!warehousesRes.ok) {
        setError(warehousesRes.error);
        setLoading(false);
        return;
      }
      setItems(itemsRes.data.items);
      setWarehouses(warehousesRes.data);
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [companyId, fetchTick]);

  // Sites are the company's projects; the address is what the crew recognises.
  const sites = useMemo<SiteRef[]>(
    () =>
      projects
        .filter((p) => !p.company_id || p.company_id === companyId)
        .map((p) => ({ id: p.id, name: p.name, address: p.address })),
    [projects, companyId]
  );

  const summary = useMemo(() => summarizeInventory(items), [items]);
  const units = useMemo(() => unitsByWarehouse(items), [items]);

  const filtered = useMemo(() => {
    const needle = debouncedQ.toLowerCase();
    return items.filter((i) => {
      if (location && i.location_type !== location) return false;
      if (condition && i.condition !== condition) return false;
      if (warehouseId && location !== "site" && i.warehouse_id !== warehouseId) return false;
      if (needle && !`${i.name} ${i.reference ?? ""} ${i.description ?? ""}`.toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [items, location, condition, warehouseId, debouncedQ]);

  const groups = useMemo(
    () => groupInventoryByLocation(filtered, { warehouses, sites }),
    [filtered, warehouses, sites]
  );

  const openCreate = () => {
    setEditItem(null);
    setItemDialogOpen(true);
  };
  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setItemDialogOpen(true);
  };

  return (
    <div className="fade-up px-4 pb-12 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-medium tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
            {t("subtitle")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setWarehousesOpen(true)}>
            <WarehouseIcon className="h-4 w-4" />
            {t("warehouses.title")}
            <span className="num" style={{ color: "var(--muted)" }}>
              {warehouses.length}
            </span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("addItem")}
          </Button>
        </div>
      </div>

      {!loading && !error && <InventorySummaryTiles summary={summary} />}

      <div className="mb-5 flex items-center gap-3">
        <InventoryFilterBar
          warehouses={warehouses}
          location={location}
          condition={condition}
          warehouseId={warehouseId}
          search={searchInput}
          onLocationChange={(v) => {
            setLocation(v);
            if (v === "site") setWarehouseId("");
          }}
          onConditionChange={setCondition}
          onWarehouseChange={setWarehouseId}
          onSearchChange={handleSearchChange}
        />
      </div>

      {loading && (
        <div className="folio-card flex items-center justify-center p-12">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted)" }} />
        </div>
      )}

      {error && !loading && (
        <div className="folio-card p-6 text-center text-[13px]" style={{ color: "var(--negative)" }}>
          {error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && groups.length === 0 && (
        <div className="folio-card flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-xl p-4" style={{ background: "var(--paper-2)" }}>
            <Wrench size={36} style={{ color: "var(--muted)" }} />
          </div>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            {items.length === 0 ? t("empty") : t("noResults")}
          </p>
          {items.length === 0 && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t("addItem")}
            </Button>
          )}
        </div>
      )}

      {!loading && !error && groups.length > 0 && (
        <InventoryGroups groups={groups} onEdit={openEdit} onDelete={setDeleteItem} />
      )}

      <InventoryItemDialog
        open={itemDialogOpen}
        onOpenChange={(open) => {
          setItemDialogOpen(open);
          if (!open) setEditItem(null);
        }}
        companyId={companyId}
        item={editItem}
        warehouses={warehouses}
        sites={sites}
        onSaved={reload}
      />

      <InventoryItemDeleteDialog
        item={deleteItem}
        open={deleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null);
        }}
        onDeleted={reload}
      />

      <WarehousesDialog
        open={warehousesOpen}
        onOpenChange={setWarehousesOpen}
        companyId={companyId}
        warehouses={warehouses}
        unitsByWarehouse={units}
        onChanged={reload}
      />
    </div>
  );
}
