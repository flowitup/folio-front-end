/**
 * Layout guards for the purse cards at narrow widths and in long locales:
 * - the dial's center amount steps its font down so 6+ digit (negative)
 *   balances stay inside the ring, and never draws wider than the hole;
 * - the breakdown type labels get a column wide enough for "Achats &
 *   prestations" / "Materials & Services" and keep the full text in a title.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpensePursesSummary } from "../expense-purses-summary";
import { PurseDial, centerValueFontSize } from "../purse-dial";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "fr",
}));

describe("PurseDial center value", () => {
  it("steps the font size down as the formatted amount grows", () => {
    expect(centerValueFontSize("8 000 €")).toBe(14.5);
    expect(centerValueFontSize("-123 457 €")).toBeLessThan(14.5);
    expect(centerValueFontSize("-1 234 567 €")).toBeLessThan(centerValueFontSize("-123 457 €"));
    expect(centerValueFontSize("-92 345 678 €")).toBeLessThan(centerValueFontSize("-1 234 567 €"));
  });

  it("caps the width inside the ring and exposes the full amount as a title", () => {
    render(
      <PurseDial percent={100} color="black" centerValue="-123 457 €" centerLabel="left" />
    );
    const value = screen.getByText("-123 457 €");
    expect(value).toHaveAttribute("title", "-123 457 €");
    expect(value.style.fontSize).toBe("12px");
    expect(value.style.maxWidth).toBe("72px");
    expect(value.className).toContain("whitespace-nowrap");
    expect(value.className).toContain("text-ellipsis");
  });
});

describe("ExpensePursesSummary breakdown labels", () => {
  it("gives each type label a wider column and a tooltip", () => {
    render(
      <ExpensePursesSummary
        invoices={[]}
        meta={{
          fundsReleasedTotal: 0,
          fundsReleasedCompanyTotal: 0,
          fundsReleasedPersonalTotal: 0,
          companySpentTotal: 0,
          personalSpentTotal: 0,
        }}
      />
    );
    const labels = screen.getAllByTitle("invoices.types.materials_services");
    // One row per purse card.
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label.className).toContain("w-32");
      expect(label.className).toContain("truncate");
    }
  });
});
