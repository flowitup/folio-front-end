import { describe, it, expect } from "vitest";
import { invoiceItemLabel } from "../invoice-item-label";

const t = (n: string) => `Bank refund — ${n}`;

describe("invoiceItemLabel", () => {
  it("translates the stored French line of an automatic bank-refund release", () => {
    expect(
      invoiceItemLabel(
        { type: "released_funds", is_auto_generated: true },
        "Remboursement banque — INV-2026-0005",
        t
      )
    ).toBe("Bank refund — INV-2026-0005");
  });

  it("keeps any line a person typed", () => {
    expect(
      invoiceItemLabel({ type: "released_funds", is_auto_generated: false }, "Remboursement banque — X", t)
    ).toBe("Remboursement banque — X");
    expect(invoiceItemLabel({ type: "materials_services" }, "Peinture", t)).toBe("Peinture");
  });
});
