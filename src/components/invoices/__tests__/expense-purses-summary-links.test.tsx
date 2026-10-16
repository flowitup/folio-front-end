/**
 * Every mark of the "Two purses" summary filters the expense list under it
 * (owner-dataviz-02), the highlighted month is the current one, never a
 * future-dated one (owner-dataviz-06), and an unfunded purse reads as spent,
 * not as "−X left" (dashboard-projects-14).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import { ExpensePursesSummary } from "../expense-purses-summary";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const plain = (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    };
    return plain;
  },
  useLocale: () => "en",
}));

function inv(overrides: Partial<Invoice>): Invoice {
  return {
    id: "x",
    project_id: "p1",
    invoice_number: "INV",
    type: "materials_services",
    issue_date: "2026-09-10",
    recipient_name: "S",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 100,
    created_by: "u",
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

const META = {
  fundsReleasedTotal: 1000,
  fundsReleasedCompanyTotal: 1000,
  fundsReleasedPersonalTotal: 0,
  companySpentTotal: 300,
  personalSpentTotal: 50,
};

const INVOICES = [
  inv({ id: "a", issue_date: "2026-09-10", total_amount: 300, paid_by_company: true }),
  inv({ id: "b", issue_date: "2026-10-03", total_amount: 50, paid_by_personal: true, type: "others" }),
  inv({ id: "c", issue_date: "2026-10-05", total_amount: 20 }),
  // Dated next month: listed as upcoming, never the highlighted month.
  inv({ id: "d", issue_date: "2026-11-20", total_amount: 900, paid_by_company: true }),
];

function renderSummary() {
  return render(
    <ExpensePursesSummary
      invoices={INVOICES}
      meta={META}
      listHref="/en/projects/p1/invoices"
      refundableHref="/en/billing/refundable-invoices?project=p1"
      referenceDate={new Date(2026, 9, 16)}
    />
  );
}

const href = (id: string) => screen.getByTestId(id).getAttribute("data-href");

describe("ExpensePursesSummary drill-downs", () => {
  it("filters the list by month, purse, type and purse+type", () => {
    renderSummary();
    expect(href("monthly-spend-bar-2026-09")).toBe("/en/projects/p1/invoices?month=2026-09");
    expect(href("purse-dial-company")).toBe("/en/projects/p1/invoices?purse=company");
    expect(href("purse-title-personal")).toBe("/en/projects/p1/invoices?purse=personal");
    expect(href("purse-type-row-personal-others")).toBe("/en/projects/p1/invoices?type=others&purse=personal");
    expect(href("purse-unassigned-spend")).toBe("/en/projects/p1/invoices?purse=none");
    expect(href("type-segment-company-materials_services")).toBe(
      "/en/projects/p1/invoices?type=materials_services&purse=company"
    );
    expect(screen.getByTestId("type-link-materials_services").getAttribute("href")).toBe(
      "/en/projects/p1/invoices?type=materials_services"
    );
  });

  it("opens the refundable list on each channel", () => {
    renderSummary();
    expect(href("refundable-by-company")).toBe("/en/billing/refundable-invoices?project=p1&channel=company");
    expect(href("refundable-by-bank")).toBe("/en/billing/refundable-invoices?project=p1&channel=bank");
  });

  it("highlights the current month and lists a future-dated month as upcoming", () => {
    renderSummary();
    expect(screen.getByTestId("monthly-spend-bar-2026-10").getAttribute("data-current")).toBe("true");
    expect(screen.getByTestId("monthly-spend-bar-2026-11").getAttribute("data-current")).toBeNull();
    expect(screen.getByTestId("monthly-spend-current").textContent).toMatch(/Oct 2026/);
    expect(screen.getByTestId("monthly-spend-current").textContent).toContain("vsMonthToDate");
    expect(screen.getByTestId("monthly-spend-upcoming").textContent).toMatch(/900/);
  });

  it("shows an unfunded purse as spent with a warning ring, and no arc at 0 %", () => {
    renderSummary();
    const dial = screen.getByTestId("purse-dial-personal");
    expect(dial.querySelector('[data-testid="purse-dial-unfunded"]')).not.toBeNull();
    expect(dial.querySelector('[data-testid="purse-dial-arc"]')).toBeNull();
    expect(dial.textContent).toContain("invoices.summary.spent");
    expect(dial.textContent).not.toContain("-");
  });
});
