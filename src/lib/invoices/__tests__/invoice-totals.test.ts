import { describe, it, expect } from "vitest";
import {
  formatQuantity,
  formatVatRate,
  invoiceTotalTtc,
  invoiceTotals,
  lineTotalTtc,
} from "../invoice-totals";

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

  it("keeps a quantity's 4th decimal", () => {
    expect(invoiceTotals([{ quantity: 0.0005, unit_price: 100 }], 0.05).totalHt).toBe(0.05);
  });

  it("handles credit lines", () => {
    expect(invoiceTotals([{ quantity: 1, unit_price: -43.1 }], -43.1).totalHt).toBe(-43.1);
  });

  it("rounds each line's HT like its TTC, so 0 % lines show no VAT", () => {
    // Two 0,125 € lines at 0 %: each shown (and totalled by the API) as 0,13 €.
    const items = [
      { quantity: 1, unit_price: 0.125 },
      { quantity: 1, unit_price: 0.125 },
    ];
    expect(invoiceTotals(items, 0.26)).toEqual({ totalHt: 0.26, totalVat: 0 });
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

describe("lineTotalTtc / invoiceTotalTtc", () => {
  it("round half-up like the API instead of truncating float drift", () => {
    // 1 × 5 × 1.055 = 5.2749999… in floats; the API stores 5.28
    expect(lineTotalTtc({ quantity: 1, unit_price: 5, vat_rate: 5.5 })).toBe(5.28);
    expect(lineTotalTtc({ quantity: 1, unit_price: 11, vat_rate: 5.5 })).toBe(11.61);
    expect(lineTotalTtc({ quantity: 1, unit_price: 19, vat_rate: 5.5 })).toBe(20.05);
    expect(invoiceTotalTtc([{ quantity: 1, unit_price: 5, vat_rate: 5.5 }])).toBe(5.28);
  });

  it("sums the lines as shown (each rounded to the cent), as the API does", () => {
    // Two lines shown as 0,01 € add up to 0,02 €, not the 0,01 € of the exact sum.
    const lines = [
      { quantity: 1, unit_price: 0.005 },
      { quantity: 1, unit_price: 0.005 },
    ];
    expect(lineTotalTtc(lines[0])).toBe(0.01);
    expect(invoiceTotalTtc(lines)).toBe(0.02);
    // 2 × (2.5 × 19.99): two 49,98 € lines make 99,96 €.
    const paint = { quantity: 2.5, unit_price: 19.99 };
    expect(invoiceTotalTtc([paint, paint])).toBe(99.96);
  });

  it("handles 3-decimal quantities, 4-decimal prices, missing VAT and credit lines", () => {
    expect(lineTotalTtc({ quantity: 2.375, unit_price: 1.859 })).toBe(4.42); // 4.415125
    expect(invoiceTotalTtc([{ quantity: 1, unit_price: -50, vat_rate: 20 }])).toBe(-60);
    expect(lineTotalTtc({ quantity: 1, unit_price: -0.005 })).toBe(-0.01);
    expect(invoiceTotalTtc([])).toBe(0);
  });
});
