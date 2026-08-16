/**
 * Tests for InvoicesPage — "Two purses" summary (design Expense Dataviz 1b).
 *
 * Covers:
 * - Company purse renders the meta released/spent figures verbatim
 * - Personal purse renders the meta released/spent figures verbatim
 * - Purse stamps count attributed EXPENSE rows (company excludes personal rows,
 *   personal counts only paid_by_personal rows)
 * - Personal stamp switches to the refundable count when refund-tracked rows exist
 *
 * Dual-render note: jsdom renders both mobile and desktop views; the summary
 * is not part of the dual-render split, so plain screen queries are safe here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  // Params are appended as a JSON suffix (rather than interpolated into the
  // key text) so tests can assert on the exact `n` passed to invoiceCount
  // without depending on real plural-message formatting.
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "en",
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({ projects: [] }),
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
  deleteInvoice: vi.fn(),
}));

vi.mock("@/components/invoices/invoice-export-dialog", () => ({
  InvoiceExportDialog: () => null,
}));

vi.mock("@/components/invoices/invoice-detail-row", () => ({
  InvoiceDetailRow: () => <div data-testid="invoice-detail-row" />,
}));

vi.mock("@/components/invoices/invoice-mobile-card", () => ({
  InvoiceMobileCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="invoice-mobile-card">{children}</div>
  ),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/tags-client", () => ({
  fetchTagsClient: vi.fn().mockResolvedValue([]),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupNavigation() {
  mockUseParams.mockReturnValue({ id: "proj-split-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-split-1/invoices");
}

function setupAuth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
}

function setupFetch(
  invoices: Invoice[],
  meta?: {
    funds_released_total?: number;
    funds_released_company_total?: number;
    funds_released_personal_total?: number;
    company_spent_total?: number;
    personal_spent_total?: number;
    company_name?: string | null;
  },
) {
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices,
    total: invoices.length,
    funds_released_total: meta?.funds_released_total ?? 0,
    funds_released_company_total: meta?.funds_released_company_total ?? 0,
    funds_released_personal_total: meta?.funds_released_personal_total ?? 0,
    company_spent_total: meta?.company_spent_total ?? 0,
    personal_spent_total: meta?.personal_spent_total ?? 0,
    company_name: meta?.company_name ?? null,
  });
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-split-1",
    project_id: "proj-split-1",
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

async function findPurseCard(title: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = screen.getByText(title).closest(".folio-card");
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupNavigation();
  setupAuth();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoicesPage — company purse card", () => {
  it("renders the meta company released/spent figures verbatim", async () => {
    setupFetch([], {
      funds_released_company_total: 80000,
      company_spent_total: 30000,
      company_name: "ACME",
    });
    render(<InvoicesPage />);

    const card = await findPurseCard("invoices.summary.companyPurse");
    expect(card.textContent).toContain("invoices.summary.released");
    expect(card.textContent).toContain("invoices.summary.spent");
    expect(card.textContent).toMatch(/80[^\d]*000/);
    expect(card.textContent).toMatch(/30[^\d]*000/);
  });

  it("stamp counts only company-attributed expense rows", async () => {
    setupFetch([
      makeInvoice({ id: "exp-company-1", paid_by_personal: false }),
      makeInvoice({ id: "exp-company-2" }), // absent flag => company
      makeInvoice({ id: "exp-personal-1", paid_by_personal: true }),
      // Released rows are capital flows — never counted as purse expenses.
      makeInvoice({ id: "rf-1", type: "released_funds", is_auto_generated: true }),
    ]);
    render(<InvoicesPage />);

    const card = await findPurseCard("invoices.summary.companyPurse");
    expect(card.textContent).toContain('invoices.invoiceCount({"n":2})');
  });
});

describe("InvoicesPage — personal purse card", () => {
  it("renders the meta personal released/spent figures verbatim", async () => {
    setupFetch([], {
      funds_released_personal_total: 5000,
      personal_spent_total: 1200,
      company_name: "ACME",
    });
    render(<InvoicesPage />);

    const card = await findPurseCard("invoices.summary.personalPurse");
    expect(card.textContent).toMatch(/5[^\d]*000/);
    expect(card.textContent).toMatch(/1[^\d]*200/);
  });

  it("stamp counts only paid_by_personal expense rows", async () => {
    setupFetch([
      makeInvoice({ id: "exp-company-1", paid_by_personal: false }),
      makeInvoice({ id: "exp-personal-1", paid_by_personal: true }),
      makeInvoice({ id: "exp-personal-2", paid_by_personal: true }),
    ]);
    render(<InvoicesPage />);

    const card = await findPurseCard("invoices.summary.personalPurse");
    expect(card.textContent).toContain('invoices.invoiceCount({"n":2})');
  });

  it("stamp switches to the refundable count when refund-tracked rows exist", async () => {
    setupFetch([
      makeInvoice({ id: "p-1", paid_by_personal: true, refundable_status: "refundable" }),
      makeInvoice({ id: "p-2", paid_by_personal: true, refundable_status: "refund_pending" }),
      // Already refunded by the company → no longer awaiting, and counted as
      // company money (BE bucket rule mirrored client-side).
      makeInvoice({ id: "p-3", paid_by_personal: true, refundable_status: "refunded" }),
      makeInvoice({ id: "p-4", paid_by_personal: true }),
    ]);
    render(<InvoicesPage />);

    const card = await findPurseCard("invoices.summary.personalPurse");
    expect(card.textContent).toContain('invoices.summary.refundableCount({"n":2})');
  });
});

describe("InvoicesPage — purse type attribution", () => {
  it("company-refunded personal expense moves to the company purse; bank-refunded stays personal", async () => {
    setupFetch([
      // Company reimbursed (refunded_by null → company by legacy default).
      makeInvoice({
        id: "co-refunded",
        paid_by_personal: true,
        refundable_status: "refunded",
        total_amount: 700,
      }),
      // Bank refunded → still personal money spent.
      makeInvoice({
        id: "bank-refunded",
        paid_by_personal: true,
        refundable_status: "refunded",
        refunded_by: "bank",
        total_amount: 300,
      }),
    ]);
    render(<InvoicesPage />);

    const summary = await waitFor(() => screen.getByTestId("expense-purses-summary"));
    const companyCard = within(summary)
      .getByText("invoices.summary.companyPurse")
      .closest(".folio-card") as HTMLElement;
    const personalCard = within(summary)
      .getByText("invoices.summary.personalPurse")
      .closest(".folio-card") as HTMLElement;

    // SPEND attribution (the purse each expense belongs to) is unchanged:
    // the company-refunded 700 sits in the company purse, the bank-refunded
    // 300 stays personal.
    expect(companyCard.textContent).toContain('invoices.invoiceCount({"n":1})');
    expect(companyCard.textContent).toMatch(/700/);
    expect(personalCard.textContent).toMatch(/300/);

    // The personal-purse stamps are RECEIVABLES, not spend — money the user
    // fronted, split by who still owes it back. Neither expense is company-
    // outstanding (both already refunded), so no company stamp renders. The
    // bank still owes the 700 (refunded_by='company'), and that money comes
    // back to the person even though the expense now sits in the company
    // purse — so it is deliberately counted here, cross-purse.
    expect(within(personalCard).queryByTestId("personal-purse-refundable-company")).toBeNull();
    const bankStamp = within(personalCard).getByTestId("personal-purse-refundable-bank");
    expect(bankStamp.textContent).toMatch(/700/);
    // The bank-refunded 300 is settled on the bank side and must not appear.
    expect(bankStamp.textContent).not.toMatch(/300/);
  });
});

describe("InvoicesPage — expenses-by-type breakdown", () => {
  it("renders one row per spent type, split across both purses, on the shared scale", async () => {
    setupFetch(
      [
        makeInvoice({ id: "ms-company", type: "materials_services", total_amount: 40000 }),
        makeInvoice({
          id: "ms-personal",
          type: "materials_services",
          total_amount: 10000,
          paid_by_personal: true,
        }),
        makeInvoice({ id: "labor-company", type: "labor", total_amount: 5000 }),
        makeInvoice({
          id: "labor-personal",
          type: "labor",
          total_amount: 20000,
          paid_by_personal: true,
        }),
        // Capital flow — must not appear as a type row.
        makeInvoice({ id: "rf-1", type: "released_funds", is_auto_generated: true }),
      ],
      { company_spent_total: 45000, personal_spent_total: 30000 },
    );
    render(<InvoicesPage />);

    const block = await waitFor(() => screen.getByTestId("expense-type-breakdown"));

    // Materials & services (50 000) outranks labor (25 000); nobody spent on "others".
    const order = Array.from(
      block.querySelectorAll<HTMLElement>('[data-testid^="type-row-"]'),
    ).map((el) => el.dataset.testid);
    expect(order).toEqual(["type-row-materials_services", "type-row-labor"]);

    // Shared scale: labor's whole bar is half of materials & services'.
    const width = (purse: string, type: string) =>
      Number.parseFloat(
        within(block).getByTestId(`type-segment-${purse}-${type}`).style.width,
      );
    const ms = width("company", "materials_services") + width("personal", "materials_services");
    const labor = width("company", "labor") + width("personal", "labor");
    expect(ms).toBeCloseTo(100, 5);
    expect(labor).toBeCloseTo(50, 5);

    // Totals reconcile with the two purses combined.
    expect(
      within(block).getByTestId("type-breakdown-total").textContent!.replace(/[^0-9]/g, ""),
    ).toContain("75000");
  });
});
