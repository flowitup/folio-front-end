import { describe, it, expect } from "vitest";
import { parseBillingListParams, parsePage } from "../billing-list-params";

describe("parseBillingListParams", () => {
  it("falls back to page 1 for a page that is not a whole number", () => {
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1.5")).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("3")).toBe(3);
  });

  it("ignores a status the kind does not have", () => {
    expect(parseBillingListParams("devis", { status: "paid" }).status).toBeUndefined();
    expect(parseBillingListParams("devis", { status: "bogus" }).status).toBeUndefined();
    expect(parseBillingListParams("facture", { status: "paid" }).status).toBe("paid");
  });

  it("trims and caps the search and keeps only a valid project id", () => {
    const parsed = parseBillingListParams("facture", {
      q: `  ${"x".repeat(150)} `,
      project_id: "not-a-uuid",
    });
    expect(parsed.q).toHaveLength(100);
    expect(parsed.projectId).toBeUndefined();
    expect(
      parseBillingListParams("facture", { project_id: "11111111-2222-3333-4444-555555555555" })
        .projectId
    ).toBe("11111111-2222-3333-4444-555555555555");
  });
});
