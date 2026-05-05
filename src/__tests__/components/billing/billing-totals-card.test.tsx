/**
 * Tests for BillingTotalsCard component and computeTotals helper.
 *
 * Required named test: test_totals_mixed_vat_rates
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BillingTotalsCard, computeTotals } from "@/components/billing/billing-totals-card";
import type { BillingDocumentItem } from "@/types/billing";

// next-intl mock — returns English values so assertions on "Total HT" / "TVA X%" still pass.
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
// computeTotals — pure logic tests (no React, no DOM)
// ---------------------------------------------------------------------------

describe("computeTotals", () => {
  it("returns zeros for empty items list", () => {
    const result = computeTotals([]);
    expect(result.totalHt).toBe(0);
    expect(result.totalTva).toBe(0);
    expect(result.totalTtc).toBe(0);
    expect(result.vatLines).toHaveLength(0);
  });

  it("single item: qty=2, unit=100, vat=20% → totalHt=200, tva=40, ttc=240", () => {
    const items: BillingDocumentItem[] = [
      { description: "Consulting", quantity: "2", unit_price: "100", vat_rate: "20" },
    ];
    const result = computeTotals(items);
    expect(result.totalHt).toBe(200);
    expect(result.totalTva).toBe(40);
    expect(result.totalTtc).toBe(240);
    expect(result.vatLines).toHaveLength(1);
    expect(result.vatLines[0].rate).toBe("20");
    expect(result.vatLines[0].baseHt).toBe(200);
    expect(result.vatLines[0].tvaAmount).toBe(40);
  });

  /**
   * test_totals_mixed_vat_rates
   * 2 items: (200 @ 20%) + (100 @ 10%) → totalHt=300, tva=50, ttc=350
   * vat_breakdown = [{rate:20, base:200, tva:40}, {rate:10, base:100, tva:10}]
   */
  it("test_totals_mixed_vat_rates", () => {
    const items: BillingDocumentItem[] = [
      { description: "Item A", quantity: "1", unit_price: "200", vat_rate: "20" },
      { description: "Item B", quantity: "1", unit_price: "100", vat_rate: "10" },
    ];
    const result = computeTotals(items);

    expect(result.totalHt).toBe(300);
    expect(result.totalTva).toBe(50);
    expect(result.totalTtc).toBe(350);
    expect(result.vatLines).toHaveLength(2);

    // VAT lines sorted descending by rate
    const rate20 = result.vatLines.find((l) => l.rate === "20");
    const rate10 = result.vatLines.find((l) => l.rate === "10");

    expect(rate20).toBeDefined();
    expect(rate20!.baseHt).toBe(200);
    expect(rate20!.tvaAmount).toBe(40);

    expect(rate10).toBeDefined();
    expect(rate10!.baseHt).toBe(100);
    expect(rate10!.tvaAmount).toBe(10);

    // Descending order: 20% first
    expect(result.vatLines[0].rate).toBe("20");
    expect(result.vatLines[1].rate).toBe("10");
  });

  it("handles 0% VAT items", () => {
    const items: BillingDocumentItem[] = [
      { description: "Zero VAT", quantity: "5", unit_price: "50", vat_rate: "0" },
    ];
    const result = computeTotals(items);
    expect(result.totalHt).toBe(250);
    expect(result.totalTva).toBe(0);
    expect(result.totalTtc).toBe(250);
  });

  it("accumulates same VAT rate across multiple items", () => {
    const items: BillingDocumentItem[] = [
      { description: "A", quantity: "1", unit_price: "100", vat_rate: "20" },
      { description: "B", quantity: "1", unit_price: "100", vat_rate: "20" },
    ];
    const result = computeTotals(items);
    expect(result.vatLines).toHaveLength(1);
    expect(result.vatLines[0].baseHt).toBe(200);
    expect(result.vatLines[0].tvaAmount).toBe(40);
  });

  it("handles decimal quantities and prices without float drift", () => {
    // Classic 0.1 + 0.2 float issue: round2 must avoid 0.30000000000000004
    const items: BillingDocumentItem[] = [
      { description: "A", quantity: "1", unit_price: "0.1", vat_rate: "0" },
      { description: "B", quantity: "1", unit_price: "0.2", vat_rate: "0" },
    ];
    const result = computeTotals(items);
    expect(result.totalHt).toBe(0.3);
    expect(result.totalTtc).toBe(0.3);
  });

  it("treats invalid quantity strings as 0 (NaN guard)", () => {
    const items: BillingDocumentItem[] = [
      { description: "Bad", quantity: "abc", unit_price: "100", vat_rate: "20" },
    ];
    const result = computeTotals(items);
    expect(result.totalHt).toBe(0);
    expect(result.totalTva).toBe(0);
  });

  it("handles 5.5% VAT rate correctly", () => {
    const items: BillingDocumentItem[] = [
      { description: "Food", quantity: "1", unit_price: "100", vat_rate: "5.5" },
    ];
    const result = computeTotals(items);
    expect(result.totalHt).toBe(100);
    expect(result.totalTva).toBe(5.5);
    expect(result.totalTtc).toBe(105.5);
  });

  it("three different VAT rates — sorted descending", () => {
    const items: BillingDocumentItem[] = [
      { description: "A", quantity: "1", unit_price: "100", vat_rate: "5.5" },
      { description: "B", quantity: "1", unit_price: "100", vat_rate: "10" },
      { description: "C", quantity: "1", unit_price: "100", vat_rate: "20" },
    ];
    const result = computeTotals(items);
    expect(result.vatLines.map((l) => l.rate)).toEqual(["20", "10", "5.5"]);
  });
});

// ---------------------------------------------------------------------------
// BillingTotalsCard — rendering tests
// ---------------------------------------------------------------------------

describe("BillingTotalsCard", () => {
  it("renders Total HT, TVA line, and Total TTC", () => {
    const totals = computeTotals([
      { description: "Consulting", quantity: "2", unit_price: "100", vat_rate: "20" },
    ]);
    render(<BillingTotalsCard totals={totals} />);

    expect(screen.getByText("Total HT")).toBeDefined();
    expect(screen.getByText("Total TTC")).toBeDefined();
    expect(screen.getByText("TVA 20%")).toBeDefined();
  });

  it("renders multiple TVA lines for mixed VAT rates", () => {
    const items: BillingDocumentItem[] = [
      { description: "A", quantity: "1", unit_price: "200", vat_rate: "20" },
      { description: "B", quantity: "1", unit_price: "100", vat_rate: "10" },
    ];
    const totals = computeTotals(items);
    render(<BillingTotalsCard totals={totals} />);

    expect(screen.getByText("TVA 20%")).toBeDefined();
    expect(screen.getByText("TVA 10%")).toBeDefined();
  });

  it("renders zero totals for empty items", () => {
    const totals = computeTotals([]);
    render(<BillingTotalsCard totals={totals} />);

    expect(screen.getByText("Total HT")).toBeDefined();
    expect(screen.getByText("Total TTC")).toBeDefined();
    // No TVA lines for empty items
    expect(screen.queryByText(/TVA \d/)).toBeNull();
  });
});
