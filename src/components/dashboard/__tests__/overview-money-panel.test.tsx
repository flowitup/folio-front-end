import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import { OverviewMoneyPanel, type OverviewMoneyPanelProps } from "../overview-money-panel";
import { computeBudgetMetrics, computeMonthDelta, type MonthlySpendPoint } from "@/lib/dashboard/overview-metrics";

function series(totals: number[]): MonthlySpendPoint[] {
  return totals.map((total, i) => ({
    key: `2026-0${i + 1}`,
    total,
    count: total > 0 ? 1 : 0,
    credited: total < 0 ? total : 0,
    creditCount: total < 0 ? 1 : 0,
  }));
}

function renderPanel(totals: number[], overrides: Partial<OverviewMoneyPanelProps> = {}, locale = "en") {
  const monthlySeries = series(totals);
  const props: OverviewMoneyPanelProps = {
    spentTotal: 0,
    budgetMetrics: computeBudgetMetrics(1000, 290, 0),
    monthlySeries,
    monthDelta: computeMonthDelta(monthlySeries),
    pendingRefunds: { count: 0, total: 0 },
    bankOutstanding: { count: 0, total: 0 },
    purses: [],
    ...overrides,
  };
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages}>
      <OverviewMoneyPanel {...props} />
    </NextIntlClientProvider>
  );
}

describe("OverviewMoneyPanel sparkline", () => {
  it.each([
    [[0, 0, 0, 0, 0, -250]],
    [[500, 300, 0, 200, 100, -250]],
  ])("keeps every point inside the chart for %j", (totals) => {
    const { container } = renderPanel(totals);
    const circles = container.querySelectorAll("svg circle");
    expect(circles.length).toBe(6);
    circles.forEach((c) => {
      const cy = Number(c.getAttribute("cy"));
      expect(cy).toBeGreaterThanOrEqual(0);
      expect(cy).toBeLessThanOrEqual(40);
    });
  });
});
