import { describe, it, expect } from "vitest";
import { toIsoDate } from "@/lib/billing/document-payload";

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
