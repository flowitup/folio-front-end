import { describe, it, expect } from "vitest";
import { toIsoDate, toItemPayload } from "@/lib/billing/document-payload";

describe("toIsoDate", () => {
  it("keeps a YYYY-MM-DD date", () => {
    expect(toIsoDate("2026-09-27")).toBe("2026-09-27");
  });

  it("reads the RFC 1123 date the API sends", () => {
    expect(toIsoDate("Sun, 27 Sep 2026 00:00:00 GMT")).toBe("2026-09-27");
  });

  it("keeps the calendar day of an ISO timestamp", () => {
    expect(toIsoDate("2026-09-27T00:00:00+00:00")).toBe("2026-09-27");
  });

  it("returns null for a missing or unreadable date", () => {
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("not a date")).toBeNull();
  });
});

describe("toItemPayload", () => {
  it("drops the computed totals the API sends with each line", () => {
    const fromApi = {
      description: "Pose",
      quantity: "2.000",
      unit_price: "125.125",
      vat_rate: "20.00",
      category: "Gros oeuvre",
      total_ht: "250.250",
      total_tva: "50.050",
      total_ttc: "300.300",
    };
    expect(toItemPayload(fromApi)).toEqual({
      description: "Pose",
      quantity: "2.000",
      unit_price: "125.125",
      vat_rate: "20.00",
      category: "Gros oeuvre",
    });
  });

  it("sends a missing or blank section as null", () => {
    const base = { description: "Pose", quantity: "1", unit_price: "1", vat_rate: "20" };
    expect(toItemPayload(base).category).toBeNull();
    expect(toItemPayload({ ...base, category: "  " }).category).toBeNull();
  });
});
