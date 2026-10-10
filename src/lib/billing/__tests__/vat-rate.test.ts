import { describe, it, expect } from "vitest";
import { formatBillingVatRate } from "@/lib/billing/vat-rate";

describe("formatBillingVatRate", () => {
  it("uses the locale's decimal separator and percent spacing", () => {
    expect(formatBillingVatRate("5.5", "fr")).toMatch(/^5,5\s%$/);
    expect(formatBillingVatRate("5.5", "en")).toBe("5.5%");
    expect(formatBillingVatRate("5.5", "vi")).toBe("5,5%");
  });

  it("drops the API's trailing zeros", () => {
    expect(formatBillingVatRate("10.00", "fr")).toMatch(/^10\s%$/);
    expect(formatBillingVatRate("5.50", "en")).toBe("5.5%");
    expect(formatBillingVatRate("8.25", "vi")).toBe("8,25%");
  });

  it("shows text that is not a number as typed", () => {
    expect(formatBillingVatRate("", "fr")).toBe("");
    expect(formatBillingVatRate("abc", "en")).toBe("abc");
  });
});
