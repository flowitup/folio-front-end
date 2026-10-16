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

describe("OverviewMoneyPanel percent formatting", () => {
  it("spaces the percent sign the French way, like the Bank credit card", () => {
    const { container } = renderPanel([100, 200, 300, 400, 500, 1800], {
      budgetMetrics: computeBudgetMetrics(null, 290, 1000),
    }, "fr");
    const text = (container.textContent ?? "").replace(/[  ]/g, " ");
    expect(text).toContain("29 % dépensé");
    expect(text).toContain("+260 % vs");
  });

  it("keeps en unchanged", () => {
    const { container } = renderPanel([100, 200, 300, 400, 500, 1800], {
      budgetMetrics: computeBudgetMetrics(null, 290, 1000),
    });
    expect(container.textContent).toContain("29% spent");
    expect(container.textContent).toContain("+260% vs");
    expect(screen.queryByText(/%%/)).toBeNull();
  });
});

describe("OverviewMoneyPanel drill-down", () => {
  const BASE = "/fr/projects/p1/invoices";
  const purses = [
    { key: "company" as const, released: 1000, spent: 400, count: 2, cashAdvanced: 0 },
    { key: "personal" as const, released: 0, spent: 120, count: 1, cashAdvanced: 0 },
  ];

  it("opens each month of the sparkline on its expenses", () => {
    const { container } = renderPanel([100, 200, 300, 400, 500, 600], { expensesHref: BASE });
    const hit = container.querySelector('[data-testid="overview-spark-2026-03"]')!;
    expect(hit.getAttribute("data-href")).toBe(`${BASE}?month=2026-03`);
    expect(hit.getAttribute("role")).toBe("link");
    expect(hit.getAttribute("tabindex")).toBe("0");
  });

  it("links the purses, the spend in no purse and the refund pills", () => {
    renderPanel([0, 0, 0, 0, 0, 100], {
      expensesHref: BASE,
      refundableHref: "/fr/billing/refundable-invoices?project=p1",
      purses,
      unassigned: { count: 1, total: 50 },
      pendingRefunds: { count: 1, total: 120 },
      bankOutstanding: { count: 1, total: 120 },
    });
    const companyLinks = screen.getByTestId("overview-purse-company").querySelectorAll("a");
    expect(companyLinks[0].getAttribute("href")).toBe(`${BASE}?purse=company`);
    expect(screen.getByTestId("overview-unassigned-spend").querySelector("a")!.getAttribute("href")).toBe(
      `${BASE}?purse=none`
    );
    expect(screen.getByTestId("dashboard-refundable-by-company").getAttribute("href")).toBe(
      "/fr/billing/refundable-invoices?project=p1&channel=company"
    );
    expect(screen.getByTestId("dashboard-refundable-by-bank").getAttribute("href")).toBe(
      "/fr/billing/refundable-invoices?project=p1&channel=bank"
    );
  });

  it("rings an unfunded purse that spent, and draws no arc at 0 %", () => {
    renderPanel([0, 0, 0, 0, 0, 100], { purses });
    const personal = screen.getByTestId("overview-purse-personal");
    expect(personal.querySelector('[data-testid="purse-dial-unfunded"]')).not.toBeNull();
    // Track only: no value arc with a round cap that drew a dot.
    expect(personal.querySelectorAll("svg circle").length).toBe(1);
  });

  it("says a month-to-date comparison is one", () => {
    const monthlySeries = series([100, 200, 300, 400, 500, 600]);
    const { container } = renderPanel([100, 200, 300, 400, 500, 600], {
      monthDelta: { ...computeMonthDelta(monthlySeries), deltaPct: 12, toDay: 15 },
    });
    expect(container.textContent).toContain("+12% vs May 1–15");
  });

  it("keeps a decimal for a share of the credit below 1 %", () => {
    const { container } = renderPanel([0, 0, 0, 0, 0, 555], {
      budgetMetrics: computeBudgetMetrics(150000.5, 555, 0),
    });
    expect(container.textContent).toContain("0.4% of credit spent");
    expect((container.textContent ?? "").replace(/[  ]/g, " ")).toContain("150 000,50 €");
  });
});
