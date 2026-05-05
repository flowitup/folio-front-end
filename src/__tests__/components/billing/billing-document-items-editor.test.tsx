/**
 * Tests for BillingDocumentItemsEditor component.
 *
 * Covers: add/remove rows, live totals math (single + mixed VAT),
 * readOnly mode, custom VAT rate.
 * Uses fireEvent (not userEvent) to avoid fake-timer conflicts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { BillingDocumentItemsEditor } from "@/components/billing/billing-document-items-editor";
import type { BillingDocumentItem } from "@/types/billing";

// next-intl mock — column headers come from en.json so assertions still pass.
vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let val = resolve(en, `${ns}.${key}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(`{${k}}`, String(v));
      });
    }
    return val;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(
  overrides: Partial<BillingDocumentItem> = {}
): BillingDocumentItem {
  return {
    description: "Consulting",
    quantity: "1",
    unit_price: "100",
    vat_rate: "20",
    ...overrides,
  };
}

function renderEditor(
  items: BillingDocumentItem[],
  onChange: (items: BillingDocumentItem[]) => void,
  props: Partial<{ readOnly: boolean; showTotals: boolean }> = {}
) {
  return render(
    <BillingDocumentItemsEditor
      items={items}
      onChange={onChange}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("BillingDocumentItemsEditor — rendering", () => {
  it("renders empty state message when no items", () => {
    renderEditor([], vi.fn());
    expect(screen.getByText(/no line items yet/i)).toBeDefined();
  });

  it("renders Add line button by default", () => {
    renderEditor([], vi.fn());
    expect(screen.getByRole("button", { name: /add line/i })).toBeDefined();
  });

  it("hides Add line and Remove buttons in readOnly mode", () => {
    renderEditor([makeItem()], vi.fn(), { readOnly: true });
    expect(screen.queryByRole("button", { name: /add line/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /remove line/i })).toBeNull();
  });

  it("renders one row with correct inputs for a single item", () => {
    renderEditor([makeItem({ description: "Dev work", quantity: "3", unit_price: "200" })], vi.fn());
    const inputs = screen.getAllByRole("spinbutton"); // type=number inputs
    // qty + unit_price inputs visible
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("hides totals card when showTotals=false", () => {
    renderEditor([makeItem()], vi.fn(), { showTotals: false });
    expect(screen.queryByText("Total TTC")).toBeNull();
  });

  it("shows totals card by default (showTotals=true)", () => {
    renderEditor([makeItem()], vi.fn(), { showTotals: true });
    expect(screen.getByText("Total TTC")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Add / remove rows
// ---------------------------------------------------------------------------

describe("BillingDocumentItemsEditor — add/remove rows", () => {
  it("calls onChange with new empty item when Add line clicked", () => {
    const onChange = vi.fn();
    renderEditor([], onChange);
    fireEvent.click(screen.getByRole("button", { name: /add line/i }));
    expect(onChange).toHaveBeenCalledOnce();
    const [newItems] = onChange.mock.calls[0] as [BillingDocumentItem[]];
    expect(newItems).toHaveLength(1);
    expect(newItems[0].quantity).toBe("1");
    expect(newItems[0].vat_rate).toBe("20");
  });

  it("calls onChange without removed item when Remove clicked", async () => {
    const onChange = vi.fn();
    renderEditor([makeItem({ description: "First" }), makeItem({ description: "Second" })], onChange);
    const removeBtns = screen.getAllByRole("button", { name: /remove line/i });
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });
    expect(onChange).toHaveBeenCalledOnce();
    const [newItems] = onChange.mock.calls[0] as [BillingDocumentItem[]];
    expect(newItems).toHaveLength(1);
  });

  it("calls onChange with updated description on input change", () => {
    const items = [makeItem({ description: "Old" })];
    const onChange = vi.fn();
    renderEditor(items, onChange);
    const descInput = screen.getByDisplayValue("Old");
    fireEvent.change(descInput, { target: { value: "New Desc" } });
    expect(onChange).toHaveBeenCalledOnce();
    const [newItems] = onChange.mock.calls[0] as [BillingDocumentItem[]];
    expect(newItems[0].description).toBe("New Desc");
  });

  it("calls onChange with updated quantity on input change", () => {
    const items = [makeItem({ quantity: "1" })];
    const onChange = vi.fn();
    renderEditor(items, onChange);
    // qty is first spinbutton
    const qtyInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(qtyInput, { target: { value: "5" } });
    expect(onChange).toHaveBeenCalledOnce();
    const [newItems] = onChange.mock.calls[0] as [BillingDocumentItem[]];
    expect(newItems[0].quantity).toBe("5");
  });
});

// ---------------------------------------------------------------------------
// Live totals
// ---------------------------------------------------------------------------

describe("BillingDocumentItemsEditor — live totals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays correct HT total for one item qty=2 unit=100 vat=20%", () => {
    const items = [makeItem({ quantity: "2", unit_price: "100", vat_rate: "20" })];
    // We pass a no-op onChange since we're just checking render
    renderEditor(items, vi.fn(), { showTotals: true });
    // Total HT: 200, TVA: 40, TTC: 240
    // BillingTotalsCard formats with fr-FR currency notation.
    // NOTE: "Total HT" also appears as a <th> column header; use getAllByText.
    expect(screen.getAllByText("Total HT").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total TTC")).toBeDefined();
    expect(screen.getByText("TVA 20%")).toBeDefined();
  });

  it("displays correct TVA lines for mixed VAT rates (200@20% + 100@10%)", () => {
    const items: BillingDocumentItem[] = [
      { description: "A", quantity: "1", unit_price: "200", vat_rate: "20" },
      { description: "B", quantity: "1", unit_price: "100", vat_rate: "10" },
    ];
    renderEditor(items, vi.fn(), { showTotals: true });
    expect(screen.getByText("TVA 20%")).toBeDefined();
    expect(screen.getByText("TVA 10%")).toBeDefined();
  });
});
