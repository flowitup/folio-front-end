/**
 * Pure inventory helpers shared by the page and its components: the category
 * vocabulary (labels live in `messages/*.json` under `inventory.categories`),
 * unit roll-ups for the summary tiles, and grouping rows by the place they are
 * at. One row is one batch of identical things in one place and one condition.
 */

import type { InventoryItem, Warehouse } from "@/lib/api/inventory";

/** Canonical category slugs in display order — mirrors the backend vocabulary. */
export const INVENTORY_CATEGORY_SLUGS = [
  "power_tool",
  "hand_tool",
  "measuring",
  "access",
  "safety",
  "machine",
  "other",
] as const;
export type InventoryCategorySlug = (typeof INVENTORY_CATEGORY_SLUGS)[number];

export function isInventoryCategorySlug(value: string): value is InventoryCategorySlug {
  return (INVENTORY_CATEGORY_SLUGS as readonly string[]).includes(value);
}

/** Known slug → localized label; null → "uncategorized"; unknown legacy value → raw. */
export function localizeInventoryCategory(
  value: string | null | undefined,
  t: (key: string) => string
): string {
  if (!value) return t("uncategorized");
  if (isInventoryCategorySlug(value)) return t(`categories.${value}`);
  return value;
}

/** Whole, non-negative units of a row — the one normalisation every roll-up uses. */
function units(item: InventoryItem): number {
  return Math.max(0, Math.floor(item.quantity));
}

export interface InventorySummary {
  entries: number;
  quantity: number;
  working: number;
  damaged: number;
  inWarehouse: number;
  onSite: number;
}

export function summarizeInventory(items: readonly InventoryItem[]): InventorySummary {
  const summary: InventorySummary = {
    entries: items.length,
    quantity: 0,
    working: 0,
    damaged: 0,
    inWarehouse: 0,
    onSite: 0,
  };
  for (const item of items) {
    const q = units(item);
    summary.quantity += q;
    if (item.condition === "damaged") summary.damaged += q;
    else summary.working += q;
    if (item.location_type === "warehouse") summary.inWarehouse += q;
    else summary.onSite += q;
  }
  return summary;
}

export interface SiteRef {
  id: string;
  name: string;
  address?: string | null;
}

export interface InventoryLocationGroup {
  /** `warehouse:<id>`, `site:<id>` or `unknown:<kind>` for a dangling reference. */
  key: string;
  kind: "warehouse" | "site";
  /** Null when the row points at a warehouse or project the client no longer knows. */
  title: string | null;
  subtitle: string | null;
  items: InventoryItem[];
  quantity: number;
}

/** Rows grouped by place: warehouses first (by name), then sites, unknown places last. */
export function groupInventoryByLocation(
  items: readonly InventoryItem[],
  refs: { warehouses: readonly Warehouse[]; sites: readonly SiteRef[] }
): InventoryLocationGroup[] {
  const warehouses = new Map(refs.warehouses.map((w) => [w.id, w]));
  const sites = new Map(refs.sites.map((s) => [s.id, s]));
  const groups = new Map<string, InventoryLocationGroup>();

  for (const item of items) {
    let key: string;
    let title: string | null = null;
    let subtitle: string | null = null;
    if (item.location_type === "warehouse") {
      const warehouse = item.warehouse_id ? warehouses.get(item.warehouse_id) : undefined;
      key = warehouse ? `warehouse:${warehouse.id}` : "unknown:warehouse";
      title = warehouse?.name ?? null;
      subtitle = warehouse?.address ?? null;
    } else {
      const site = item.project_id ? sites.get(item.project_id) : undefined;
      key = site ? `site:${site.id}` : "unknown:site";
      title = site?.name ?? null;
      subtitle = site?.address ?? null;
    }
    const group = groups.get(key) ?? {
      key,
      kind: item.location_type,
      title,
      subtitle,
      items: [],
      quantity: 0,
    };
    group.items.push(item);
    group.quantity += units(item);
    groups.set(key, group);
  }

  const rank = (g: InventoryLocationGroup) => (g.title === null ? 2 : g.kind === "warehouse" ? 0 : 1);
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => rank(a) - rank(b) || (a.title ?? "").localeCompare(b.title ?? ""));
}

/** Units stored per warehouse id, so a warehouse row can say what deleting it would strand. */
export function unitsByWarehouse(items: readonly InventoryItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items)
    if (item.location_type === "warehouse" && item.warehouse_id)
      map.set(item.warehouse_id, (map.get(item.warehouse_id) ?? 0) + units(item));
  return map;
}

/** Whole non-negative number or null: a typo must never land as 0 units. */
export function parseQuantity(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
