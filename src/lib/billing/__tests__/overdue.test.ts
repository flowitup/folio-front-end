import { describe, it, expect } from "vitest";
import { overdueDays } from "../overdue";

describe("overdueDays", () => {
  const facture = { kind: "facture" as const, status: "sent" as const, payment_due_date: "2026-10-31" };

  it("counts Paris days past the due date", () => {
    expect(overdueDays(facture, "2026-11-20")).toBe(20);
  });

  it("is null on or before the due date", () => {
    expect(overdueDays(facture, "2026-10-31")).toBeNull();
    expect(overdueDays(facture, "2026-10-01")).toBeNull();
  });

  it("is null for paid, draft and cancelled factures, devis and missing dates", () => {
    expect(overdueDays({ ...facture, status: "paid" }, "2026-11-20")).toBeNull();
    expect(overdueDays({ ...facture, status: "draft" }, "2026-11-20")).toBeNull();
    expect(overdueDays({ ...facture, status: "cancelled" }, "2026-11-20")).toBeNull();
    expect(overdueDays({ ...facture, kind: "devis" }, "2026-11-20")).toBeNull();
    expect(overdueDays({ ...facture, payment_due_date: null }, "2026-11-20")).toBeNull();
  });

  it("counts a facture marked overdue by hand too", () => {
    expect(overdueDays({ ...facture, status: "overdue" }, "2026-11-02")).toBe(2);
  });
});
