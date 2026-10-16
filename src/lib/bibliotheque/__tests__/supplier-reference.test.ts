import { describe, it, expect } from "vitest";
import { displayedSupplierReference } from "@/lib/bibliotheque/supplier-reference";

describe("displayedSupplierReference", () => {
  it("hides the placeholder the API generates for a product with no reference", () => {
    expect(displayedSupplierReference("manual-5e7ea6ca3685")).toBeNull();
    expect(displayedSupplierReference("  ")).toBeNull();
    expect(displayedSupplierReference(null)).toBeNull();
  });

  it("shows a real reference", () => {
    expect(displayedSupplierReference(" 69128452 ")).toBe("69128452");
  });
});
