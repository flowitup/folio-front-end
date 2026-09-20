/**
 * inventory-groups.test.tsx — rows grouped by place, quantity leading, a
 * damaged row flagged, edit and delete wired to the row.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryGroups } from "../inventory-groups";
import { groupInventoryByLocation } from "@/lib/inventory/inventory";
import type { InventoryItem, Warehouse } from "@/lib/api/inventory";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const map: Record<string, string> = {
      unknownLocation: "Unknown location",
      uncategorized: "Uncategorized",
      "fields.quantity": "Quantity",
      "fields.name": "Name",
      "fields.category": "Category",
      "fields.reference": "Reference",
      "fields.condition": "Condition",
      "actions.rowActions": "Actions",
      "actions.edit": "Edit",
      "actions.delete": "Delete",
      "condition.working": "Working",
      "condition.damaged": "Damaged",
      "categories.power_tool": "Power tools",
    };
    return (key: string, values?: { count?: number }) =>
      key === "units" ? `${values?.count ?? 0} units` : (map[key] ?? key);
  },
}));

const WAREHOUSE: Warehouse = {
  id: "w1",
  company_id: "c1",
  name: "Kho Bình Thạnh",
  address: "12 Nguyễn Hữu Cảnh",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const DRILL: InventoryItem = {
  id: "drill",
  company_id: "c1",
  name: "Máy khoan Bosch",
  category: "power_tool",
  reference: "SN-778",
  description: null,
  quantity: 3,
  condition: "working",
  location_type: "warehouse",
  warehouse_id: "w1",
  project_id: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const SCREWDRIVER: InventoryItem = {
  ...DRILL,
  id: "screwdriver",
  name: "Visseuse Makita",
  reference: null,
  quantity: 1,
  condition: "damaged",
  location_type: "site",
  warehouse_id: null,
  project_id: "p1",
};

describe("InventoryGroups", () => {
  const groups = groupInventoryByLocation([DRILL, SCREWDRIVER], {
    warehouses: [WAREHOUSE],
    sites: [{ id: "p1", name: "Villa Thảo Điền", address: "Quận 2" }],
  });

  it("renders one section per place with its address and unit total", () => {
    render(<InventoryGroups groups={groups} onEdit={vi.fn()} onDelete={vi.fn()} />);
    const warehouse = screen.getByTestId("inventory-group-warehouse:w1");
    expect(warehouse).toHaveTextContent("Kho Bình Thạnh");
    expect(warehouse).toHaveTextContent("12 Nguyễn Hữu Cảnh");
    expect(warehouse).toHaveTextContent("3 units");
    expect(screen.getByTestId("inventory-group-site:p1")).toHaveTextContent("Villa Thảo Điền");
  });

  it("flags the damaged row and shows the quantity first", () => {
    render(<InventoryGroups groups={groups} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId("inventory-item-screwdriver-condition")).toHaveTextContent("Damaged");
    expect(screen.getByTestId("inventory-item-screwdriver-condition")).toHaveClass("negative");
    expect(screen.getByTestId("inventory-item-drill-condition")).toHaveClass("positive");
    expect(within(screen.getByTestId("inventory-item-drill")).getAllByRole("cell")[0]).toHaveTextContent("3");
  });

  it("wires edit and delete to the row", async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<InventoryGroups groups={groups} onEdit={onEdit} onDelete={onDelete} />);
    const row = screen.getByTestId("inventory-item-drill");
    await userEvent.click(within(row).getByRole("button", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(DRILL);
    await userEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith(DRILL);
  });
});
