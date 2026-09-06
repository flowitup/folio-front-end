/**
 * Tests for InvoicesPage — company-paid expenses: ratio card + transfer action gating.
 *
 * Covers:
 * - Funds released card ratio reads from company_spent_total (not refunded)
 * - Transfer action hidden when invoice.paid_by_company=true (M&S, null status)
 * - Transfer action still shown when paid_by_company=false or absent
 *
 * Dual-render note: jsdom renders both mobile and desktop views.
 * Desktop assertions are scoped via data-testid="invoices-table-desktop".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      if (!params) return full;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        full,
      );
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
  InvoiceMobileCard: ({
    children,
    invoice,
  }: {
    children?: React.ReactNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any;
  }) => (
    <div data-testid="invoice-mobile-card">
      {children}
      {invoice.paid_by_company && (
        <span data-testid="mobile-paid-by-company" />
      )}
    </div>
  ),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  mockUseParams.mockReturnValue({ id: "proj-cp-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-cp-1/invoices");
}

function setupAuth(canManage: boolean) {
  const perms = canManage ? ["project:manage_invoices"] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: perms } } as any);
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
    id: "inv-cp-1",
    project_id: "proj-cp-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 500,
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

// ── Tests: ratio card reads company_spent_total ────────────────────────────────

describe("InvoicesPage — company funds released ratio reads company_spent_total", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigation();
    setupAuth(false);
  });

  it("renders company_spent_total in the company purse when > 0", async () => {
    setupFetch([], {
      funds_released_total: 50000,
      company_spent_total: 12500,
      company_name: "ANN ECO CONSTRUCTION",
    });
    render(<InvoicesPage />);

    const card = await waitFor(
      () => {
        const el = screen
          .getByText("invoices.summary.companyPurse")
          .closest(".folio-card");
        expect(el).not.toBeNull();
        return el as HTMLElement;
      },
      { timeout: 5000 },
    );
    expect(card.textContent).toMatch(/12[^\d]*500/);
  });

  it("renders the company purse even when company_spent_total is 0", async () => {
    setupFetch([], { funds_released_total: 20000, company_spent_total: 0 });
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.queryByText("invoices.summary.companyPurse")).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });
});

// ── Tests: transfer action hidden when paid_by_company ────────────────────────

describe("InvoicesPage — transfer action hidden for paid_by_company invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigation();
    setupAuth(true);
  });

  it("hides transfer action for M&S null-status invoice when paid_by_company=true", async () => {
    setupFetch([
      makeInvoice({ type: "materials_services", refundable_status: null, paid_by_company: true }),
    ]);
    render(<InvoicesPage />);

    await waitFor(
      () => screen.getByTestId("invoices-table-desktop"),
      { timeout: 5000 },
    );

    const desktop = screen.getByTestId("invoices-table-desktop");
    expect(
      within(desktop).queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).toBeNull();
  });

  it("shows transfer action for M&S null-status invoice when paid_by_company=false", async () => {
    setupFetch([
      makeInvoice({ type: "materials_services", refundable_status: null, paid_by_company: false }),
    ]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(
          within(desktop).queryByRole("button", { name: "invoices.refund.action.transfer" }),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("shows transfer action for M&S null-status invoice when paid_by_company is absent", async () => {
    // paid_by_company omitted (undefined) — should default to showing the action
    setupFetch([makeInvoice({ type: "materials_services", refundable_status: null })]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(
          within(desktop).queryByRole("button", { name: "invoices.refund.action.transfer" }),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("still hides transfer action when refundable_status is already set (regardless of paid_by_company)", async () => {
    setupFetch([
      makeInvoice({
        type: "materials_services",
        refundable_status: "refundable",
        paid_by_company: false,
      }),
    ], { company_name: "Co" });
    render(<InvoicesPage />);

    await waitFor(
      () => screen.getByTestId("invoices-table-desktop"),
      { timeout: 5000 },
    );

    const desktop = screen.getByTestId("invoices-table-desktop");
    expect(
      within(desktop).queryByRole("button", { name: "invoices.refund.action.transfer" }),
    ).toBeNull();
  });
});
