import { describe, expect, it } from "vitest";
import {
  closedMonthsFor,
  closedMonthsFromDate,
  formatClosureMonth,
  monthKeyOf,
  unsettledPaymentCount,
} from "../month-closure";
import type { LaborPaymentsSummaryResponse } from "@/types/labor";

const CLOSED = [{ month: "2026-10" }, { month: "2026-08" }];

describe("month closure helpers", () => {
  it("reads the month of a day or a month", () => {
    expect(monthKeyOf("2026-10-25")).toBe("2026-10");
    expect(monthKeyOf("2026-10")).toBe("2026-10");
    expect(monthKeyOf("2026-10-01T00:00:00Z")).toBe("2026-10");
    expect(monthKeyOf("")).toBeNull();
    expect(monthKeyOf(null)).toBeNull();
    expect(monthKeyOf("oct")).toBeNull();
  });

  it("labels a month as MM/YYYY", () => {
    expect(formatClosureMonth("2026-11")).toBe("11/2026");
    expect(formatClosureMonth("x")).toBe("x");
  });

  it("finds the closed months a write touches, once each, sorted", () => {
    expect(closedMonthsFor(CLOSED, ["2026-10-25", "2026-10-26", "2026-09-01", "2026-08"])).toEqual([
      "2026-08",
      "2026-10",
    ]);
    expect(closedMonthsFor(CLOSED, ["2026-11-02", null, undefined])).toEqual([]);
    expect(closedMonthsFor([], ["2026-10-25"])).toEqual([]);
  });

  it("a dated rate change reaches every closed month from its day on", () => {
    expect(closedMonthsFromDate(CLOSED, "2026-08-15")).toEqual(["2026-08", "2026-10"]);
    expect(closedMonthsFromDate(CLOSED, "2026-09-01")).toEqual(["2026-10"]);
    expect(closedMonthsFromDate(CLOSED, "2026-11-01")).toEqual([]);
    expect(closedMonthsFromDate(CLOSED, "")).toEqual([]);
  });

  it("counts the month's payments with no worker plus every payment with no month", () => {
    const summary: LaborPaymentsSummaryResponse = {
      months: [
        { year: 2026, month: 10, total_paid: 300, unassigned_paid: 100, unassigned_count: 1, workers: [{ worker_id: "w", worker_name: "W", paid: 200, invoice_count: 2 }] },
        { year: 2026, month: 9, total_paid: 50, unassigned_paid: 50, unassigned_count: 4, workers: [] },
        { year: null, month: null, total_paid: 70, unassigned_paid: 20, unassigned_count: 1, workers: [{ worker_id: "w", worker_name: "W", paid: 50, invoice_count: 1 }] },
      ],
    } as LaborPaymentsSummaryResponse;
    expect(unsettledPaymentCount(summary, "2026-10")).toBe(1 + 2);
    expect(unsettledPaymentCount(summary, "2026-11")).toBe(2);
    expect(unsettledPaymentCount(null, "2026-10")).toBe(0);
  });
});
