/** Warehouses dialog: delete blocked by equipment rows (even of 0 units), and duplicate names refused. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { Warehouse } from "@/lib/api/inventory";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/[locale]/(app)/inventory/_actions/inventory-actions", () => ({
  createWarehouseAction: vi.fn(),
  updateWarehouseAction: vi.fn(),
  deleteWarehouseAction: vi.fn(),
}));

import { createWarehouseAction } from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import { WarehousesDialog } from "../warehouses-dialog";

const WAREHOUSE = { id: "w1", company_id: "c1", name: "Main", address: null } as Warehouse;

function renderDialog(rows: number) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WarehousesDialog
        open
        onOpenChange={vi.fn()}
        companyId="c1"
        warehouses={[WAREHOUSE]}
        unitsByWarehouse={new Map([["w1", 0]])}
        rowsByWarehouse={new Map([["w1", rows]])}
        onChanged={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("WarehousesDialog", () => {
  it("warns before deleting a warehouse whose only row holds 0 units", () => {
    renderDialog(1);
    fireEvent.click(screen.getByRole("button", { name: "Delete warehouse" }));
    expect(screen.getByText(/still lists 1 piece of equipment/)).toBeInTheDocument();
    expect(screen.queryByText(/still holds 0 units/)).toBeNull();
  });

  it("refuses a second warehouse with the same name", () => {
    renderDialog(0);
    fireEvent.click(screen.getByRole("button", { name: "Add warehouse" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  main " } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add warehouse" }).at(-1)!);
    expect(screen.getByText("A warehouse already has this name.")).toBeInTheDocument();
    expect(createWarehouseAction).not.toHaveBeenCalled();
  });
});
