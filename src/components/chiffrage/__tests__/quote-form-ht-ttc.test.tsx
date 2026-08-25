/**
 * quote-form-ht-ttc.test.tsx
 *
 * Leroy Merlin prints TTC on the shelf, Point P quotes HT. If the form stored
 * whichever number was typed, two offers for the same product would differ by
 * the VAT rate and the cheaper one would look dearer. These tests pin the
 * conversion in both directions and at every rate the form offers.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { QuoteFormDialog } from "../quote-form-dialog";
import { ttcToHt, htToTtc } from "../format";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, opts?: Record<string, unknown>) =>
    key === "storedAsHt" ? `stored ${opts?.ht} / ${opts?.ttc}` : key,
}));

// The bibliothèque picker does its own network work; it is exercised separately.
vi.mock("../supplier-product-picker", () => ({
  SupplierProductPicker: () => null,
}));

async function fill(price: string, mode: "ht" | "ttc", tva?: string) {
  const onSubmit = vi.fn();
  render(
    <QuoteFormDialog
      open
      quote={null}
      submitting={false}
      companyId={null}
      onOpenChange={() => {}}
      onSubmit={onSubmit}
    />
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("supplier"), "Leroy Merlin");
  if (tva) {
    const tvaInput = screen.getByLabelText("tvaRate");
    await user.clear(tvaInput);
    await user.type(tvaInput, tva);
  }
  if (mode === "ttc") await user.click(screen.getByTestId("price-mode-ttc"));
  await user.type(screen.getByLabelText("unitPrice"), price);
  return { onSubmit, user };
}

describe("QuoteFormDialog HT/TTC handling", () => {
  it("stores a TTC shelf price as its HT equivalent", async () => {
    const { onSubmit, user } = await fill("12.90", "ttc");
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(Number(onSubmit.mock.calls[0][0].unit_price_ht)).toBeCloseTo(10.75, 2);
  });

  it("stores an HT quote unchanged", async () => {
    const { onSubmit, user } = await fill("12.40", "ht");
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(Number(onSubmit.mock.calls[0][0].unit_price_ht)).toBeCloseTo(12.4, 2);
  });

  it.each([
    ["20", 12.9, 10.75],
    ["10", 11.0, 10.0],
    ["5.5", 10.55, 10.0],
  ])("converts TTC at %s%% VAT", async (tva, ttc, expectedHt) => {
    const { onSubmit, user } = await fill(String(ttc), "ttc", tva);
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(Number(onSubmit.mock.calls[0][0].unit_price_ht)).toBeCloseTo(expectedHt, 2);
    expect(onSubmit.mock.calls[0][0].tva_rate).toBe(tva);
  });

  it("shows both figures before submitting so the entry can be checked", async () => {
    await fill("12.90", "ttc");
    expect(screen.getByTestId("price-conversion")).toHaveTextContent("10,75");
    expect(screen.getByTestId("price-conversion")).toHaveTextContent("12,90");
  });

  it("refuses to submit without a fournisseur, and says why", async () => {
    const onSubmit = vi.fn();
    render(
      <QuoteFormDialog
        open
        quote={null}
        submitting={false}
        companyId={null}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("unitPrice"), "10");
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(onSubmit).not.toHaveBeenCalled();
    // The button stays live on purpose: a dead one left the user guessing
    // which field was blocking the price, which is what felt broken.
    expect(screen.getByTestId("quote-form-error")).toHaveTextContent(
      "supplierRequired"
    );
  });

  it("confirms the converted price before a fournisseur is named", async () => {
    render(
      <QuoteFormDialog
        open
        quote={null}
        submitting={false}
        companyId={null}
        onOpenChange={() => {}}
        onSubmit={vi.fn()}
      />
    );
    await userEvent.type(screen.getByLabelText("unitPrice"), "10");
    expect(screen.getByTestId("price-conversion")).toHaveTextContent("10,00");
  });

  it("clears the error once the missing field is filled in", async () => {
    const onSubmit = vi.fn();
    render(
      <QuoteFormDialog
        open
        quote={null}
        submitting={false}
        companyId={null}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("unitPrice"), "10");
    await user.click(screen.getByRole("button", { name: "create" }));
    expect(screen.getByTestId("quote-form-error")).toBeInTheDocument();

    await user.type(screen.getByLabelText("supplier"), "Point P");
    expect(screen.queryByTestId("quote-form-error")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "create" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].supplier_name).toBe("Point P");
  });

  it("reports a missing price rather than a missing fournisseur", async () => {
    const onSubmit = vi.fn();
    render(
      <QuoteFormDialog
        open
        quote={null}
        submitting={false}
        companyId={null}
        onOpenChange={() => {}}
        onSubmit={onSubmit}
      />
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("supplier"), "Point P");
    await user.click(screen.getByRole("button", { name: "create" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("quote-form-error")).toHaveTextContent(
      "priceRequired"
    );
  });
});

describe("conversion helpers", () => {
  it("round-trips a price through TTC and back", () => {
    for (const rate of [20, 10, 5.5, 0]) {
      expect(ttcToHt(htToTtc(10.75, rate), rate)).toBeCloseTo(10.75, 6);
    }
  });

  it("treats a 0% rate as a no-op", () => {
    expect(htToTtc(10.75, 0)).toBe(10.75);
    expect(ttcToHt(10.75, 0)).toBe(10.75);
  });
});
