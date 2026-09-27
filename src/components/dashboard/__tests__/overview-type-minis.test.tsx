import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { OverviewTypeMinis } from "../overview-type-minis";
import { EXPENSE_TYPES, type TypeMonthlyBucket } from "@/lib/dashboard/overview-metrics";

const MESSAGES = { en: enMessages, fr: frMessages, vi: viMessages } as const;
const KEYS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

function buckets(totals: number[] = [0, 0, 0]): TypeMonthlyBucket[] {
  return EXPENSE_TYPES.map((type, i) => ({
    type,
    monthly: KEYS.map((key) => ({ key, total: 0, count: 0, credited: 0, creditCount: 0 })),
    total: totals[i],
    count: 0,
    deltaPct: null,
  }));
}

function renderMinis(locale: keyof typeof MESSAGES, b = buckets()) {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      <OverviewTypeMinis buckets={b} viewExpenseHref={null} />
    </NextIntlClientProvider>
  );
}

function ticks(container: HTMLElement) {
  return Array.from(container.querySelectorAll("svg"))[0]
    .querySelectorAll("text");
}

describe("OverviewTypeMinis month ticks", () => {
  it("uses compact T<n> ticks in Vietnamese so the six labels don't overlap", () => {
    const { container } = renderMinis("vi");
    expect(Array.from(ticks(container)).map((n) => n.textContent)).toEqual(["T4", "T5", "T6", "T7", "T8", "T9"]);
  });

  it("keeps the short month name in English", () => {
    const { container } = renderMinis("en");
    expect(ticks(container)[0].textContent).toBe("Apr");
  });
});

describe("OverviewTypeMinis totals", () => {
  it("shows type totals that add up to the 6-month total", () => {
    const { container } = renderMinis("en", buckets([1500.5, 449.6, 99.9]));
    const text = (container.textContent ?? "").replace(/[  ]/g, " ");
    expect(text).toContain("1 500 €");
    expect(text).toContain("450 €");
    expect(text).toContain("100 €");
    expect(text).toContain("2 050 €");
    expect(screen.queryByText(/1 501/)).toBeNull();
  });
});

describe("OverviewTypeMinis screen-reader table", () => {
  it("lists each month's amount, count and returns next to the hidden chart", () => {
    const b = buckets([750, 0, 0]);
    b[0].monthly[5] = { key: "2026-09", total: -50, count: 0, credited: -50, creditCount: 1 };
    renderMinis("en", b);
    const table = screen.getAllByRole("table")[0];
    expect(table).toHaveTextContent("Sep 2026");
    expect(table.textContent?.replace(/[\u202f\u00a0]/g, " ")).toContain("-50 €");
    expect(table).toHaveTextContent(/return/i);
  });
});
