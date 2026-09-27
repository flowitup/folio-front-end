import { describe, it, expect } from "vitest";
import { monthSettlement } from "../month-settlement";
import type { LaborPaymentsMonthBucket } from "@/types/labor";

const bucket = (
  workers: { worker_id: string; paid: number }[],
  unassigned_paid = 0,
): LaborPaymentsMonthBucket => ({
  year: 2026,
  month: 9,
  total_paid: workers.reduce((s, w) => s + w.paid, 0) + unassigned_paid,
  workers: workers.map((w) => ({ ...w, worker_name: w.worker_id, invoice_count: 1 })),
  unassigned_paid,
  unassigned_count: unassigned_paid > 0 ? 1 : 0,
});

describe("monthSettlement", () => {
  it("does not net one worker's overpayment against another's debt", () => {
    const r = monthSettlement(
      [
        { worker_id: "a", total_cost: 300 },
        { worker_id: "b", total_cost: 300 },
      ],
      bucket([
        { worker_id: "a", paid: 600 },
        { worker_id: "b", paid: 0 },
      ]),
    );
    expect(r).toEqual({ shortfall: 300, overpay: 300 });
  });

  it("does not let unassigned payments settle a worker", () => {
    const r = monthSettlement([{ worker_id: "a", total_cost: 200 }], bucket([], 200));
    expect(r).toEqual({ shortfall: 200, overpay: 0 });
  });

  it("counts a payment to a worker with no cost that month as overpaid", () => {
    const r = monthSettlement([{ worker_id: "a", total_cost: 100 }], bucket([
      { worker_id: "a", paid: 100 },
      { worker_id: "z", paid: 50 },
    ]));
    expect(r).toEqual({ shortfall: 0, overpay: 50 });
  });

  it("reads a missing bucket as nothing paid", () => {
    expect(monthSettlement([{ worker_id: "a", total_cost: 80 }], undefined)).toEqual({
      shortfall: 80,
      overpay: 0,
    });
  });
});
