/**
 * inventory.test.ts — the pure helpers behind the inventory page: unit
 * roll-ups, grouping by place, warehouse counts, quantity parsing, labels.
 */
import { describe, it, expect } from "vitest";
import type { InventoryItem, Warehouse } from "@/lib/api/inventory";
import {
  groupInventoryByLocation,
  localizeInventoryCategory,
  parseQuantity,
  summarizeInventory,
  unitsByWarehouse,
} from "../inventory";

const WAREHOUSE: Warehouse = {
  id: "w1",
  company_id: "c1",
  name: "Kho Bình Thạnh",
  address: "12 Nguyễn Hữu Cảnh",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function item(overrides: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    company_id: "c1",
    name: "Máy khoan Bosch",
    category: "power_tool",
    reference: null,
    description: null,
    quantity: 1,
    condition: "working",
    location_type: "warehouse",
    warehouse_id: "w1",
    project_id: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

const ITEMS: InventoryItem[] = [
  item({ id: "a", quantity: 3 }),
  item({ id: "b", quantity: 1, condition: "damaged", reference: "SN-778" }),
  item({ id: "c", name: "Visseuse Makita", quantity: 2, location_type: "site", warehouse_id: null, project_id: "p1" }),
  item({ id: "d", name: "Thang nhôm", quantity: 1, location_type: "site", warehouse_id: null, project_id: "gone" }),
];

describe("summarizeInventory", () => {
  it("counts units, not rows, split by condition and place", () => {
    expect(summarizeInventory(ITEMS)).toEqual({
      entries: 4,
      quantity: 7,
      working: 6,
      damaged: 1,
      inWarehouse: 4,
      onSite: 3,
    });
  });
});

describe("groupInventoryByLocation", () => {
  it("puts warehouses first, then sites, and dangling references last without a title", () => {
    const groups = groupInventoryByLocation(ITEMS, {
      warehouses: [WAREHOUSE],
      sites: [{ id: "p1", name: "Villa Thảo Điền", address: "Quận 2" }],
    });
    expect(groups.map((g) => g.key)).toEqual(["warehouse:w1", "site:p1", "unknown:site"]);
    expect(groups[0]).toMatchObject({ title: "Kho Bình Thạnh", subtitle: "12 Nguyễn Hữu Cảnh", quantity: 4 });
    expect(groups[1]).toMatchObject({ title: "Villa Thảo Điền", subtitle: "Quận 2", quantity: 2 });
    expect(groups[2]).toMatchObject({ title: null, quantity: 1 });
  });
});

describe("unitsByWarehouse", () => {
  it("floors and ignores rows on sites", () => {
    const units = unitsByWarehouse([...ITEMS, item({ id: "e", quantity: 2.5, warehouse_id: "w2" })]);
    expect(units.get("w1")).toBe(4);
    expect(units.get("w2")).toBe(2);
    expect(units.has("p1")).toBe(false);
  });
});

describe("parseQuantity", () => {
  it("accepts whole non-negative numbers only", () => {
    expect(parseQuantity("3")).toBe(3);
    expect(parseQuantity(" 0 ")).toBe(0);
    for (const bad of ["", "1.5", "-2", "+2", "abc"]) expect(parseQuantity(bad)).toBeNull();
  });
});

describe("localizeInventoryCategory", () => {
  const t = (key: string) => `[${key}]`;
  it("labels known slugs, names the absence, passes unknown values through", () => {
    expect(localizeInventoryCategory("power_tool", t)).toBe("[categories.power_tool]");
    expect(localizeInventoryCategory(null, t)).toBe("[uncategorized]");
    expect(localizeInventoryCategory("legacy", t)).toBe("legacy");
  });
});
