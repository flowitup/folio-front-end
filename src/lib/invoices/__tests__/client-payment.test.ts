import { describe, it, expect } from "vitest";
import { isClientPayment } from "../client-payment";

describe("isClientPayment", () => {
  it("is a released-funds row created from a paid facture", () => {
    expect(isClientPayment({ type: "released_funds", source_billing_document_id: "fac-1" })).toBe(true);
  });

  it("is not a manual disbursement nor another type", () => {
    expect(isClientPayment({ type: "released_funds", source_billing_document_id: null })).toBe(false);
    expect(isClientPayment({ type: "labor", source_billing_document_id: "fac-1" })).toBe(false);
    expect(
      isClientPayment({ type: "released_funds", source_billing_document_id: "fac-1", is_cash_advance: true }),
    ).toBe(false);
  });
});
