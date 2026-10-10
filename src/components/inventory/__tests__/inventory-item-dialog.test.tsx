/** Inventory item dialog: a site row whose project was deleted is never moved to the first site on save. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { InventoryItem } from "@/lib/api/inventory";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/[locale]/(app)/inventory/_actions/inventory-actions", () => ({
  createInventoryItemAction: vi.fn(),
  updateInventoryItemAction: vi.fn(),
}));

import { updateInventoryItemAction } from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import { InventoryItemDialog } from "../inventory-item-dialog";

const SITES = [
  { id: "p1", name: "Villa Arcueil" },
  { id: "p2", name: "Extension Meaux" },
];

function siteItem(projectId: string | null): InventoryItem {
  return {
    id: "i1",
    company_id: "c1",
    name: "Ladder",
    category: null,
    reference: null,
    description: null,
    quantity: 1,
    condition: "working",
    location_type: "site",
    warehouse_id: null,
    project_id: projectId,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function renderDialog(item: InventoryItem) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InventoryItemDialog
        open
        onOpenChange={vi.fn()}
        companyId="c1"
        item={item}
        warehouses={[]}
        sites={SITES}
        onSaved={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}

function renameAndSave() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ladder renamed" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
}

beforeEach(() => vi.clearAllMocks());

describe("InventoryItemDialog", () => {
  it("asks for a site instead of moving a row whose project was deleted", async () => {
    renderDialog(siteItem(null));
    renameAndSave();
    expect(await screen.findByText("Pick a site.")).toBeInTheDocument();
    expect(updateInventoryItemAction).not.toHaveBeenCalled();
  });

  it("renames a row on its site without sending its location", async () => {
    vi.mocked(updateInventoryItemAction).mockResolvedValue({ ok: true, data: siteItem("p2") } as never);
    renderDialog(siteItem("p2"));
    renameAndSave();
    await waitFor(() => expect(updateInventoryItemAction).toHaveBeenCalledWith("i1", { name: "Ladder renamed" }));
  });
});
