/**
 * Unit tests for ExpensePursesSummary (design Expense Dataviz 1b).
 *
 * Covers the computation guards and interactions the page tests don't:
 * - released = 0 → dial/bars render 0-safe (no NaN)
 * - missing funds_released_company_total falls back to total − personal
 * - credit strip hidden without refund invoices, shown with count + net sum
 * - delegated data-tip tooltip shows on hover and hides on leave
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import { ExpensePursesSummary } from "../expense-purses-summary";

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "en",
}));

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1000,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

const ZERO_META = {
  fundsReleasedTotal: 0,
  fundsReleasedCompanyTotal: 0,
  fundsReleasedPersonalTotal: 0,
  companySpentTotal: 0,
  personalSpentTotal: 0,
};

describe("ExpensePursesSummary — zero-released guard", () => {
  it("renders without NaN when nothing is released or spent", () => {
    const { container } = render(<ExpensePursesSummary invoices={[]} meta={ZERO_META} />);
    expect(container.textContent).not.toContain("NaN");
    // Both purse dials show a 0 € remainder.
    expect(container.textContent).toContain("invoices.summary.companyPurse");
    expect(container.textContent).toContain("invoices.summary.personalPurse");
  });
});

describe("ExpensePursesSummary — released split fallback", () => {
  it("derives company released as total − personal when the split is absent", () => {
    render(
      <ExpensePursesSummary
        invoices={[]}
        meta={{
          fundsReleasedTotal: 100000,
          fundsReleasedCompanyTotal: undefined,
          fundsReleasedPersonalTotal: 30000,
          companySpentTotal: 0,
          personalSpentTotal: 0,
        }}
      />
    );
    const card = screen
      .getByText("invoices.summary.companyPurse")
      .closest(".folio-card") as HTMLElement;
    expect(card.textContent).toMatch(/70[^\d]*000/);
    expect(card.textContent).not.toContain("NaN");
  });
});

describe("ExpensePursesSummary — credit strip", () => {
  it("is hidden when there are no refund invoices", () => {
    render(<ExpensePursesSummary invoices={[makeInvoice()]} meta={ZERO_META} />);
    expect(screen.queryByText("invoices.summary.credit")).toBeNull();
  });

  it("shows the refund count and net (negative) sum", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice(),
          makeInvoice({ id: "ref-1", type: "refund", total_amount: -3000 }),
          makeInvoice({ id: "ref-2", type: "refund", total_amount: -1820 }),
        ]}
        meta={ZERO_META}
      />
    );
    expect(screen.getByText("invoices.summary.credit")).toBeDefined();
    expect(
      screen.getByText('invoices.summary.refundsReceived({"n":2})')
    ).toBeDefined();
    // Net −4 820 €, fr-FR formatted; match the digits only.
    expect(screen.getByText(/4[^\d]*820/)).toBeDefined();
  });
});

describe("ExpensePursesSummary — overspent purse", () => {
  it("shows the true negative balance instead of clamping to 0 €", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ total_amount: 15310, paid_by_personal: true }),
        ]}
        meta={{
          fundsReleasedTotal: 10919,
          fundsReleasedCompanyTotal: 0,
          fundsReleasedPersonalTotal: 10919,
          companySpentTotal: 0,
          personalSpentTotal: 15310,
        }}
      />
    );
    // Personal purse dial center: 10 919 − 15 310 = −4 391 €, in the negative color.
    const personalCard = screen
      .getByText("invoices.summary.personalPurse")
      .closest(".folio-card") as HTMLElement;
    const dialValue = Array.from(
      personalCard.querySelectorAll<HTMLElement>(".num")
    ).find((el) => /-4[^\d]*391/.test(el.textContent ?? ""));
    expect(dialValue).toBeDefined();
    expect(dialValue?.style.color).toBe("var(--negative)");
  });

  it("keeps the dial ring capped at full when spending exceeds released", () => {
    const { container } = render(
      <ExpensePursesSummary
        invoices={[]}
        meta={{
          fundsReleasedTotal: 1000,
          fundsReleasedCompanyTotal: 0,
          fundsReleasedPersonalTotal: 1000,
          companySpentTotal: 0,
          personalSpentTotal: 2000,
        }}
      />
    );
    // Every dial arc's dash length stays ≤ the full circumference (2π·44).
    const circumference = 2 * Math.PI * 44;
    const arcs = Array.from(
      container.querySelectorAll<SVGCircleElement>("circle[stroke-dasharray]")
    );
    expect(arcs.length).toBeGreaterThan(0);
    for (const arc of arcs) {
      const filled = parseFloat(arc.getAttribute("stroke-dasharray") ?? "0");
      expect(filled).toBeLessThanOrEqual(circumference + 0.001);
    }
  });
});

describe("ExpensePursesSummary — dark-card KPIs", () => {
  it("sums pending refunds over refundable + refund_pending personal expenses only", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "a", paid_by_personal: true, refundable_status: "refundable", total_amount: 1200 }),
          makeInvoice({ id: "b", paid_by_personal: true, refundable_status: "refund_pending", total_amount: 800 }),
          // Already refunded and company-paid rows don't count.
          makeInvoice({ id: "c", paid_by_personal: true, refundable_status: "refunded", refunded_by: "bank", total_amount: 500 }),
          makeInvoice({ id: "d", paid_by_personal: false, total_amount: 900 }),
        ]}
        meta={ZERO_META}
      />
    );
    const amount = screen.getByText("invoices.summary.pendingRefunds")
      .nextElementSibling as HTMLElement;
    expect(amount.textContent).toMatch(/2[^\d]*000/);
    expect(amount.style.color).toBe("rgb(241, 200, 163)");
  });

  it("renders one bar per month from project start, filling gap months", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "mar", issue_date: "2026-03-10", total_amount: 1000 }),
          // April has no expense — still gets a (stub) bar.
          makeInvoice({ id: "may", issue_date: "2026-05-05", total_amount: 3000 }),
        ]}
        meta={ZERO_META}
      />
    );
    const bars = screen.getByTestId("monthly-spend-bars").children;
    expect(bars.length).toBe(3); // Mar, Apr (gap), May
    expect((bars[2] as HTMLElement).style.background).toBe("var(--accent)");
  });

  it("shows the latest month total with a delta vs the previous month", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "jun", issue_date: "2026-06-01", total_amount: 2000 }),
          makeInvoice({ id: "jul", issue_date: "2026-07-01", total_amount: 1000 }),
        ]}
        meta={ZERO_META}
      />
    );
    // 1 000 vs 2 000 → −50%; mocked t() interpolates the raw params.
    expect(
      screen.getByText(/vsMonth\(\{"delta":"-50%","month":"Jun"\}\)/)
    ).toBeDefined();
  });

  it("buckets labor by service_month instead of issue_date", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "w", type: "labor", issue_date: "2026-07-03", service_month: "2026-06-01", total_amount: 500 }),
        ]}
        meta={ZERO_META}
      />
    );
    const bars = screen.getByTestId("monthly-spend-bars").children;
    expect(bars.length).toBe(1); // single June bucket, no July bar
    expect((bars[0] as HTMLElement).dataset.tip).toContain("Jun 2026");
  });
});

describe("ExpensePursesSummary — data-tip tooltip", () => {
  it("shows the tooltip on hover over a mark and hides it on leave", () => {
    render(
      <ExpensePursesSummary
        invoices={[makeInvoice({ type: "labor", total_amount: 500, paid_by_personal: false })]}
        meta={{ ...ZERO_META, fundsReleasedTotal: 1000, companySpentTotal: 500 }}
      />
    );
    const root = screen.getByTestId("expense-purses-summary");
    const mark = root.querySelector("[data-tip]") as HTMLElement;
    expect(mark).not.toBeNull();

    fireEvent.mouseMove(mark);
    // Tooltip splits "label|value|meta" — the label line is rendered.
    const label = (mark.dataset.tip ?? "").split("|")[0];
    expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);

    fireEvent.mouseLeave(root);
    // The fixed overlay is gone (only the original mark text can remain).
    expect(root.querySelector(".fixed.z-50")).toBeNull();
  });
});
