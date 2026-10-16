import { describe, it, expect } from "vitest";
import { billingBackPath, projectBackQuery } from "../back-target";

const P = "fa0eee10-7870-4684-beba-49f6c078c0ae";

describe("billing back target", () => {
  it("returns to the project's billing tab when opened from it", () => {
    const back = new URLSearchParams(projectBackQuery(P)).get("back");
    expect(billingBackPath(back, "/fr/billing/devis", "fr")).toBe(`/fr/projects/${P}/billing`);
  });

  it("falls back to the company-wide list otherwise, never off-site", () => {
    expect(billingBackPath(null, "/fr/billing/devis", "fr")).toBe("/fr/billing/devis");
    expect(billingBackPath("https://evil.example", "/en/billing/factures", "en")).toBe("/en/billing/factures");
    expect(billingBackPath("project:../../x", "/en/billing/factures", "en")).toBe("/en/billing/factures");
  });
});
