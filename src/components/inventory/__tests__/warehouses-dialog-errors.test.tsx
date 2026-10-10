/**
 * A refused warehouse action shows translated text, never the server
 * action's English message: deleting a non-empty warehouse in French keeps
 * the French "Déplacez-le" wording after the confirm click, a 409 on save
 * means the name is taken, and 403/404 use the inventory's own strings.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";
import enMessages from "@/messages/en.json";
import type { Warehouse } from "@/lib/api/inventory";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/app/[locale]/(app)/inventory/_actions/inventory-actions", () => ({
  createWarehouseAction: vi.fn(),
  updateWarehouseAction: vi.fn(),
  deleteWarehouseAction: vi.fn(),
}));

import { toast } from "sonner";
import {
  deleteWarehouseAction,
  updateWarehouseAction,
} from "@/app/[locale]/(app)/inventory/_actions/inventory-actions";
import { WarehousesDialog } from "../warehouses-dialog";

const WAREHOUSE = { id: "w1", company_id: "c1", name: "Dépôt plein", address: null } as Warehouse;

function renderDialog(locale: "fr" | "en", rows: number) {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages}>
      <WarehousesDialog
        open
        onOpenChange={vi.fn()}
        companyId="c1"
        warehouses={[WAREHOUSE]}
        unitsByWarehouse={new Map([["w1", 1]])}
        rowsByWarehouse={new Map([["w1", rows]])}
        onChanged={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("WarehousesDialog error messages", () => {
  it("keeps the French blocked-delete message (singular pronoun) after confirming", async () => {
    vi.mocked(deleteWarehouseAction).mockResolvedValue({
      ok: false,
      error: "This warehouse still holds equipment. Move or remove it first.",
      code: "Conflict",
    });
    renderDialog("fr", 1);
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.warehouses.delete }));
    const expected = "Ce dépôt contient encore 1 équipement. Déplacez-le ou retirez-le d'abord.";
    expect(screen.getByText(expected)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.actions.delete }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expected));
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(/still holds equipment/)).toBeNull();
  });

  it("uses the plural pronoun for several rows", () => {
    renderDialog("en", 2);
    fireEvent.click(screen.getByRole("button", { name: enMessages.inventory.warehouses.delete }));
    expect(
      screen.getByText("This warehouse still lists 2 pieces of equipment. Move or remove them first.")
    ).toBeInTheDocument();
  });

  it("translates a 404 instead of showing 'Not found.'", async () => {
    vi.mocked(deleteWarehouseAction).mockResolvedValue({ ok: false, error: "Not found.", code: "NotFound" });
    renderDialog("fr", 0);
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.warehouses.delete }));
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.actions.delete }));
    await waitFor(() => expect(screen.getByText(frMessages.inventory.toast.notFound)).toBeInTheDocument());
    expect(screen.queryByText("Not found.")).toBeNull();
  });

  it("reads a 409 on rename as a taken name, in French", async () => {
    vi.mocked(updateWarehouseAction).mockResolvedValue({
      ok: false,
      error: "This warehouse still holds equipment. Move or remove it first.",
      code: "Conflict",
    });
    renderDialog("fr", 0);
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.warehouses.edit }));
    fireEvent.change(screen.getByLabelText(frMessages.inventory.warehouses.fields.name), {
      target: { value: "Autre nom" },
    });
    fireEvent.submit(screen.getByLabelText(frMessages.inventory.warehouses.fields.name).closest("form")!);
    await waitFor(() =>
      expect(screen.getByText(frMessages.inventory.warehouses.validation.nameTaken)).toBeInTheDocument()
    );
    expect(toast.error).toHaveBeenCalledWith(frMessages.inventory.warehouses.validation.nameTaken);
  });

  it("translates a 403", async () => {
    vi.mocked(deleteWarehouseAction).mockResolvedValue({
      ok: false,
      error: "You don't have permission to manage the inventory.",
      code: "Forbidden",
    });
    renderDialog("fr", 0);
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.warehouses.delete }));
    fireEvent.click(screen.getByRole("button", { name: frMessages.inventory.actions.delete }));
    await waitFor(() => expect(screen.getByText(frMessages.inventory.toast.forbidden)).toBeInTheDocument());
  });
});
