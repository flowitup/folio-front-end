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
import { render, screen, fireEvent, within } from "@testing-library/react";
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
          makeInvoice({ id: "ref-1", type: "return", total_amount: -3000 }),
          makeInvoice({ id: "ref-2", type: "return", total_amount: -1820 }),
        ]}
        meta={ZERO_META}
      />
    );
    expect(screen.getByText("invoices.summary.credit")).toBeDefined();
    expect(
      screen.getByText('invoices.summary.refundsReceived({"n":2})')
    ).toBeDefined();
    // Net −4 820 €, fr-FR formatted; match the digits only. Scoped to the
    // headline total testid — the per-purse split row below can carry the
    // same figure when every refund lands in one purse.
    expect(screen.getByTestId("credit-strip-total").textContent).toMatch(/4[^\d]*820/);
  });
});

describe("ExpensePursesSummary — refund netting", () => {
  it("deducts refunds from the dark-card total so it equals company + personal spent", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-1", total_amount: 10000 }), // company
          makeInvoice({ id: "exp-2", total_amount: 5000, paid_by_personal: true }),
          makeInvoice({
            id: "ref-1",
            type: "return",
            total_amount: -1000,
            refunds_invoice_id: "exp-1",
          }),
        ]}
        meta={ZERO_META}
      />
    );
    // Headline = 10 000 + 5 000 − 1 000 = 14 000 (net), not 15 000 (gross).
    // Scoped to the headline element: the monthly timeline stays gross by
    // design, so 15 000 legitimately appears elsewhere on the card.
    const headline = screen.getByText("invoices.summary.totalExpenses")
      .nextElementSibling as HTMLElement;
    expect(headline.textContent).toMatch(/14[^\d]*000/);
    expect(headline.textContent).not.toMatch(/15[^\d]*000/);
  });

  it("deducts a linked refund from the refunded invoice's category and purse", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-lab", type: "labor", total_amount: 2000 }),
          makeInvoice({ id: "exp-mat", total_amount: 3000 }),
          makeInvoice({
            id: "ref-lab",
            type: "return",
            total_amount: -500,
            refunds_invoice_id: "exp-lab",
          }),
        ]}
        meta={ZERO_META}
      />
    );
    const card = screen
      .getByText("invoices.summary.companyPurse")
      .closest(".folio-card") as HTMLElement;
    // Labor row shows 2 000 − 500 = 1 500; materials stays 3 000.
    expect(card.textContent).toMatch(/1[^\d]*500/);
    expect(card.textContent).toMatch(/3[^\d]*000/);
    expect(card.textContent).not.toMatch(/2[^\d]*000/);
  });

  it("falls back to materials & services for unlinked refunds and follows paid_by for the purse", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-p", total_amount: 4000, paid_by_personal: true }),
          makeInvoice({
            id: "ref-p",
            type: "return",
            total_amount: -250,
            paid_by_personal: true,
            refunds_invoice_id: null,
          }),
        ]}
        meta={ZERO_META}
      />
    );
    const card = screen
      .getByText("invoices.summary.personalPurse")
      .closest(".folio-card") as HTMLElement;
    // Personal materials row nets to 4 000 − 250 = 3 750.
    expect(card.textContent).toMatch(/3[^\d]*750/);
    expect(card.textContent).not.toMatch(/4[^\d]*000/);
  });

  it("never renders a negative-width bar when a category is over-refunded", () => {
    const { container } = render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-oth", type: "others", total_amount: 100 }),
          makeInvoice({ id: "exp-mat2", total_amount: 1000 }),
          makeInvoice({
            id: "ref-oth",
            type: "return",
            total_amount: -300,
            refunds_invoice_id: "exp-oth",
          }),
        ]}
        meta={ZERO_META}
      />
    );
    const bars = Array.from(
      container.querySelectorAll<HTMLElement>(".folio-card span[data-tip]")
    );
    for (const bar of bars) {
      const width = parseFloat(bar.style.width || "0");
      expect(width).toBeGreaterThanOrEqual(0);
      expect(width).toBeLessThanOrEqual(100);
    }
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
    const amount = within(screen.getByTestId("refundable-by-company"))
      .getByText(/\d/) as HTMLElement;
    expect(amount.textContent).toMatch(/2[^\d]*000/);
    expect(amount.style.color).toBe("rgb(241, 200, 163)");
    // The personal-purse stamp carries the same total next to the count.
    const stamp = screen.getByText(/summary\.refundableCount/).closest(".stamp") as HTMLElement;
    expect(stamp.textContent).toMatch(/·\s*2[^\d]*000/);
  });

  it("tracks the bank channel independently of refundable_status", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          // Neither side settled — counts in BOTH balances.
          makeInvoice({ id: "a", paid_by_personal: true, refundable_status: "refundable", total_amount: 1200 }),
          // Company reimbursed, bank has not — company balance only drops this
          // one; the bank still owes it. This is the row the old single
          // "pending refunds" figure silently lost.
          makeInvoice({ id: "b", paid_by_personal: true, refundable_status: "refunded", refunded_by: "company", total_amount: 500 }),
          // Both settled — in neither balance.
          makeInvoice({ id: "c", paid_by_personal: true, refundable_status: "refunded", refunded_by: "both", total_amount: 300 }),
          // Bank settled, company did not reimburse — out of the bank balance.
          makeInvoice({ id: "d", paid_by_personal: true, refundable_status: "refunded", refunded_by: "bank", total_amount: 700 }),
          // Not refund-tracked at all.
          makeInvoice({ id: "e", paid_by_personal: false, total_amount: 900 }),
        ]}
        meta={ZERO_META}
      />
    );
    const companyAmount = within(screen.getByTestId("refundable-by-company"))
      .getByText(/\d/) as HTMLElement;
    const bankAmount = within(screen.getByTestId("refundable-by-bank"))
      .getByText(/\d/) as HTMLElement;
    // Company: only "a" is still owed back by the company.
    expect(companyAmount.textContent).toMatch(/1[^\d]*200/);
    // Bank: "a" + "b" = 1 700 — deliberately overlapping the company figure
    // and larger than it, so the two must never be summed or stacked.
    expect(bankAmount.textContent).toMatch(/1[^\d]*700/);
    expect(bankAmount.style.color).toBe("rgb(157, 201, 232)");
  });

  it("counts a bank-outstanding expense regardless of which purse holds it", () => {
    // A company-reimbursed expense is reassigned to the COMPANY purse by
    // isPersonalExpense, yet the bank still owes it — the bank balance must
    // not be gated on the personal purse.
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "b", paid_by_personal: true, refundable_status: "refunded", refunded_by: "company", total_amount: 640 }),
        ]}
        meta={ZERO_META}
      />
    );
    const companyAmount = within(screen.getByTestId("refundable-by-company"))
      .getByText(/\d/) as HTMLElement;
    const bankAmount = within(screen.getByTestId("refundable-by-bank"))
      .getByText(/\d/) as HTMLElement;
    expect(companyAmount.textContent).toMatch(/0/);
    expect(bankAmount.textContent).toMatch(/640/);
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

describe("ExpensePursesSummary — avoir returns (per-purse rows, strip split, outstanding chip)", () => {
  // Fixture: one company M&S expense + one personal M&S expense, each with a
  // return netted against it; the personal return is an outstanding avoir
  // (settled_via='avoir', no applied_to_invoice_id yet), the company return is
  // a plain cash return.
  const invoices: Invoice[] = [
    makeInvoice({ id: "exp-company", total_amount: 10000 }),
    makeInvoice({ id: "exp-personal", total_amount: 8000, paid_by_personal: true }),
    makeInvoice({
      id: "ref-company",
      type: "return",
      total_amount: -1500,
      refunds_invoice_id: "exp-company",
      settled_via: "cash",
    }),
    makeInvoice({
      id: "ref-personal",
      type: "return",
      total_amount: -2000,
      paid_by_personal: true,
      refunds_invoice_id: "exp-personal",
      settled_via: "avoir",
      applied_to_invoice_id: null,
    }),
  ];

  const META = {
    fundsReleasedTotal: 30000,
    fundsReleasedCompanyTotal: 20000,
    fundsReleasedPersonalTotal: 10000,
    companySpentTotal: 8500,
    personalSpentTotal: 6000,
  };

  it("renders a 'Returns received' row on each purse card with the netted count + amount", () => {
    render(<ExpensePursesSummary invoices={invoices} meta={META} />);

    const companyRow = screen.getByTestId("purse-returns-row-company");
    expect(companyRow.textContent).toContain('invoices.summary.returnsReceived({"n":1})');
    expect(companyRow.textContent).toMatch(/1[^\d]*500/);

    const personalRow = screen.getByTestId("purse-returns-row-personal");
    expect(personalRow.textContent).toContain('invoices.summary.returnsReceived({"n":1})');
    expect(personalRow.textContent).toMatch(/2[^\d]*000/);
  });

  it("omits the 'Returns received' row when a purse has no returns", () => {
    render(
      <ExpensePursesSummary
        invoices={[makeInvoice({ id: "exp-1", total_amount: 500 })]}
        meta={ZERO_META}
      />
    );
    expect(screen.queryByTestId("purse-returns-row-company")).toBeNull();
    expect(screen.queryByTestId("purse-returns-row-personal")).toBeNull();
  });

  it("splits the credit strip into company/personal totals", () => {
    render(<ExpensePursesSummary invoices={invoices} meta={META} />);

    const split = screen.getByTestId("credit-strip-split");
    expect(split.textContent).toMatch(/1[^\d]*500/);
    expect(split.textContent).toMatch(/2[^\d]*000/);
  });

  it("shows the outstanding-avoirs chip when an avoir return has no applied_to_invoice_id", () => {
    render(<ExpensePursesSummary invoices={invoices} meta={META} />);

    const chip = screen.getByTestId("outstanding-avoirs-chip");
    expect(chip.textContent).toContain('invoices.summary.outstandingAvoirs({"n":1})');
    expect(chip.textContent).toMatch(/2[^\d]*000/);
  });

  it("hides the outstanding-avoirs chip when every avoir return is applied", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-1", total_amount: 5000 }),
          makeInvoice({
            id: "ref-1",
            type: "return",
            total_amount: -800,
            settled_via: "avoir",
            applied_to_invoice_id: "exp-1",
          }),
        ]}
        meta={ZERO_META}
      />
    );
    expect(screen.queryByTestId("outstanding-avoirs-chip")).toBeNull();
  });

  it("hides the outstanding-avoirs chip when returns are cash-settled", () => {
    render(
      <ExpensePursesSummary
        invoices={[
          makeInvoice({ id: "exp-1", total_amount: 5000 }),
          makeInvoice({
            id: "ref-1",
            type: "return",
            total_amount: -800,
            settled_via: "cash",
          }),
        ]}
        meta={ZERO_META}
      />
    );
    expect(screen.queryByTestId("outstanding-avoirs-chip")).toBeNull();
  });

  it("keeps the purse Spent headers equal to the BE meta values (netting not double-applied client-side)", () => {
    render(<ExpensePursesSummary invoices={invoices} meta={META} />);

    // Spent header reads the raw meta.companySpentTotal / meta.personalSpentTotal
    // verbatim — the client-side return netting only feeds the type bars/rows,
    // never the header figure itself.
    const companyCard = screen
      .getByText("invoices.summary.companyPurse")
      .closest(".folio-card") as HTMLElement;
    const spentLine = within(companyCard)
      .getByText("invoices.summary.spent")
      .closest("div") as HTMLElement;
    expect(spentLine.textContent).toMatch(/8[^\d]*500/);

    const personalCard = screen
      .getByText("invoices.summary.personalPurse")
      .closest(".folio-card") as HTMLElement;
    const personalSpentLine = within(personalCard)
      .getByText("invoices.summary.spent")
      .closest("div") as HTMLElement;
    expect(personalSpentLine.textContent).toMatch(/6[^\d]*000/);
  });
});
