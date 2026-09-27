import { describe, it, expect } from "vitest";
import { formatQuantity, formatVatRate, invoiceTotals } from "../invoice-totals";

describe("invoiceTotals", () => {
  it("rounds the HT sum half-up to the cent instead of truncating a float", () => {
    // 1.5 × 33.53 = 50.295 exactly; in floats it is 50.294999…
    const { totalHt, totalVat } = invoiceTotals([{ quantity: 1.5, unit_price: 33.53 }], 60.35);
    expect(totalHt).toBe(50.3);
    expect(totalVat).toBe(10.05);
  });

  it("makes HT + VAT equal the invoice total", () => {
    const items = [
      { quantity: 3, unit_price: 0.1 },
      { quantity: 2.5, unit_price: 19.99 },
    ];
    const { totalHt, totalVat } = invoiceTotals(items, 62.3);
    expect(Math.round((totalHt + totalVat) * 100)).toBe(6230);
    expect(totalHt).toBe(50.28);
  });

  it("handles credit lines", () => {
    expect(invoiceTotals([{ quantity: 1, unit_price: -43.1 }], -43.1).totalHt).toBe(-43.1);
  });
});

describe("formatQuantity / formatVatRate", () => {
  it("use the app language", () => {
    expect(formatQuantity(1.5, "fr")).toBe("1,5");
    expect(formatQuantity(1.5, "en")).toBe("1.5");
    expect(formatVatRate(5.5, "fr")).toMatch(/^5,5\s%$/);
    expect(formatVatRate(20, "en")).toBe("20%");
  });
});
