/**
 * Tests for RefundableSummaryCards — the KPI strip above the refundable
 * invoices table (total refunded, split by company/bank, outstanding).
 *
 * Verifies:
 *   - Renders nothing when summary is null
 *   - All 4 amounts render, formatted as EUR
 *   - Split bar hidden when refunded_total === 0
 *   - Split bar percentages computed correctly and rendered
 *
 * Mocking strategy: next-intl key-lookup against en.json (project convention).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RefundableSummaryCards } from "../refundable-summary-cards";
import { formatEUR } from "@/lib/utils/formatters";
import type { RefundableSummary } from "@/types/invoice";

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let str = resolve(en, `${ns}.${key}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };
  return {
    useTranslations: (ns: string) => makeT(ns),
  };
});

function makeSummary(overrides: Partial<RefundableSummary> = {}): RefundableSummary {
  return {
    refundable_amount: 500,
    refunded_total: 1000,
    refunded_by_company: 600,
    refunded_by_bank: 400,
    ...overrides,
  };
}

describe("RefundableSummaryCards", () => {
  it("renders nothing when summary is null", () => {
    const { container } = render(<RefundableSummaryCards summary={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders all 4 amounts formatted as EUR", () => {
    render(<RefundableSummaryCards summary={makeSummary()} />);

    expect(screen.getByTestId("summary-card-refunded-total").textContent).toContain(formatEUR(1000));
    expect(screen.getByTestId("summary-card-refunded-by-company").textContent).toContain(formatEUR(600));
    expect(screen.getByTestId("summary-card-refunded-by-bank").textContent).toContain(formatEUR(400));
    expect(screen.getByTestId("summary-card-refundable").textContent).toContain(formatEUR(500));
  });

  it("hides the split bar when refunded_total is 0", () => {
    render(
      <RefundableSummaryCards
        summary={makeSummary({ refunded_total: 0, refunded_by_company: 0, refunded_by_bank: 0 })}
      />
    );
    expect(screen.queryByTestId("refund-split-bar")).toBeNull();
  });

  it("renders the split bar with correct percentages when refunded_total > 0", () => {
    render(
      <RefundableSummaryCards
        summary={makeSummary({ refunded_total: 1000, refunded_by_company: 600, refunded_by_bank: 400 })}
      />
    );
    const bar = screen.getByTestId("refund-split-bar");
    expect(bar).toBeDefined();

    const companySegment = screen.getByTestId("refund-split-bar-company");
    const bankSegment = screen.getByTestId("refund-split-bar-bank");
    expect(companySegment.style.width).toBe("60%");
    expect(bankSegment.style.width).toBe("40%");

    expect(screen.getByText("60% company")).toBeDefined();
    expect(screen.getByText("40% bank")).toBeDefined();
  });

  it("computes percentages for an uneven split", () => {
    render(
      <RefundableSummaryCards
        summary={makeSummary({ refunded_total: 3, refunded_by_company: 1, refunded_by_bank: 2 })}
      />
    );
    // 1/3 = 33.33% rounds to 33; 2/3 = 66.67% rounds to 67
    expect(screen.getByText("33% company")).toBeDefined();
    expect(screen.getByText("67% bank")).toBeDefined();
  });

  it("labels always sum to 100% even when independent rounding would not", () => {
    // 495/1000 → 49.5% rounds to 50; independently-rounded bank (50.5 → 51)
    // would read 101%. The bank label is the complement, so 50/50.
    render(
      <RefundableSummaryCards
        summary={makeSummary({ refunded_total: 1000, refunded_by_company: 495, refunded_by_bank: 505 })}
      />
    );
    expect(screen.getByText("50% company")).toBeDefined();
    expect(screen.getByText("50% bank")).toBeDefined();
  });
});
