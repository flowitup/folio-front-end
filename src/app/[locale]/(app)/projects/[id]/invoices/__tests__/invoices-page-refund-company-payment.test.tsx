/**
 * Tests for InvoicesPage — refund-to-company payment markers, KPI fixes, transfer action.
 *
 * Covers:
 * - Total expenses KPI excludes released_funds and labor (only non-released expenses)
 * - Funds released card renders "X / Y" from meta company_spent_total + funds_released_total
 * - Payment method arrow renders for refund-tracked M&S row, absent when refundable_status null
 * - Refund status stamp renders per status (refundable/refund_pending/refunded)
 * - "refunded" status uses "stamp positive" class
 * - Transfer action visible only for M&S + null refundable_status + canManageInvoices
 * - Transfer action calls setRefundableStatus("refundable") on click + reloads
 * - Transfer action shows forbidden toast on 403
 *
 * Dual-render note: jsdom renders both mobile cards and desktop table.
 * Desktop table assertions are scoped via data-testid="invoices-table-desktop".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks (hoisted before dynamic imports) ─────────────────────────────

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
    companyName,
  }: {
    children?: React.ReactNode;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any;
    companyName?: string | null;
  }) => (
    <div data-testid="invoice-mobile-card">
      {/* Reproduce the arrow+stamp logic so mobile assertions work */}
      {invoice.refundable_status != null && companyName && (
        <span data-testid="mobile-arrow-label">
          {invoice.payment_method_label
            ? `${invoice.payment_method_label} → ${companyName}`
            : `→ ${companyName}`}
        </span>
      )}
      {invoice.refundable_status != null && (
        <span data-testid={`mobile-stamp-${invoice.refundable_status}`}>
          {`invoices.refund.status.${
            invoice.refundable_status === "refund_pending" ? "refundPending" : invoice.refundable_status
          }`}
        </span>
      )}
      {children}
    </div>
  ),
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api/tags-client", () => ({
  fetchTagsClient: vi.fn().mockResolvedValue([]),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/http";
import InvoicesPage from "../page";

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);
const mockSetRefundableStatus = vi.mocked(setRefundableStatus);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupNavigationMocks() {
  mockUseParams.mockReturnValue({ id: "proj-refund-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-refund-1/invoices");
}

function setupAuthMock(canManage: boolean) {
  const perms = canManage ? ["project:manage_invoices"] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: perms } } as any);
}

function setupFetchMock(
  invoices: Invoice[],
  meta?: {
    funds_released_total?: number;
    funds_released_company_total?: number;
    funds_released_personal_total?: number;
    company_spent_total?: number;
    personal_spent_total?: number;
    company_name?: string | null;
  }
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

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-base",
    project_id: "proj-refund-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-05-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1000,
    created_by: "user-1",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

// ── Test suites ───────────────────────────────────────────────────────────────

describe("InvoicesPage — headline total reads the BE spent meta", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
    setupAuthMock(false);
  });

  it("headline total sums expense rows only, never the released_funds amount", async () => {
    // Released rows are capital flows: the headline sums the expense rows
    // (10 000 + 5 000) — the 97 376 release must never leak into it.
    const invoices = [
      makeInvoice({ id: "rf-1", type: "released_funds", total_amount: 97376 }),
      makeInvoice({ id: "lab-1", type: "labor", total_amount: 10000 }),
      makeInvoice({ id: "ms-1", type: "materials_services", total_amount: 5000 }),
    ];
    setupFetchMock(invoices, { company_spent_total: 10000, personal_spent_total: 5000 });
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull(), {
      timeout: 5000,
    });

    const summary = screen.getByTestId("expense-purses-summary");
    const totalBlock = within(summary)
      .getByText("invoices.summary.totalExpenses")
      // Dark total card: label → inner block → card root.
      .closest("div.flex.flex-col.justify-between") as HTMLElement;
    expect(totalBlock).not.toBeNull();

    // formatEURWhole uses fr-FR spacing (narrow no-break spaces); match digits only.
    expect(totalBlock.textContent).toMatch(/15[^\d]*000/);
    expect(totalBlock.textContent).not.toMatch(/97[^\d]*376/);
    // Expense count line renders (this file's intl mock drops params; exact
    // per-purse counts are asserted in invoices-page-expense-purses-summary).
    expect(totalBlock.textContent).toContain("invoices.invoiceCount");
  });
});

describe("InvoicesPage — company purse shows company_spent / funds_released_company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
    setupAuthMock(false);
  });

  it("renders company_spent_total and funds_released_company_total in the company purse", async () => {
    setupFetchMock([], {
      funds_released_company_total: 97376,
      company_spent_total: 10919,
      company_name: "ANN ECO CONSTRUCTION",
    });
    render(<InvoicesPage />);

    const card = await waitFor(
      () => {
        const el = screen.getByText("invoices.summary.companyPurse").closest(".folio-card");
        expect(el).not.toBeNull();
        return el as HTMLElement;
      },
      { timeout: 5000 },
    );
    expect(card.textContent).toMatch(/10[^\d]*919/);
    expect(card.textContent).toMatch(/97[^\d]*376/);
  });

  it("displays the BE-reduced company_spent_total verbatim (company refund already netted server-side)", async () => {
    // The backend nets company-issued refunds out of company_spent_total and
    // floors at 0; the page must render that value as-is (no client recompute).
    // Here a 10 919 company spend was reduced to 4 242 by company refunds.
    setupFetchMock([], {
      funds_released_company_total: 97376,
      company_spent_total: 4242,
      company_name: "ANN ECO CONSTRUCTION",
    });
    render(<InvoicesPage />);

    const fundsCard = await waitFor(
      () => {
        const card = screen.getByText("invoices.summary.companyPurse").closest(".folio-card");
        expect(card).not.toBeNull();
        return card as HTMLElement;
      },
      { timeout: 5000 },
    );

    // formatEURWhole uses fr-FR spacing (narrow no-break spaces); match digits only.
    // Reduced numerator 4 242 and denominator 97 376 both appear in this card.
    expect(fundsCard.textContent).toMatch(/4[^\d]*242/);
    expect(fundsCard.textContent).toMatch(/97[^\d]*376/);
  });
});

describe("InvoicesPage — payment method arrow for refund-tracked rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
    setupAuthMock(false);
  });

  it("renders arrow label on desktop for M&S row with refundable_status and company_name", async () => {
    setupFetchMock(
      [makeInvoice({ id: "ms-refund", payment_method_label: "CB - TRUNG", refundable_status: "refundable" })],
      { company_name: "ANN ECO CONSTRUCTION" },
    );
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText(/CB - TRUNG → ANN ECO CONSTRUCTION/)).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("renders arrow without payment method label when label is null", async () => {
    setupFetchMock(
      [makeInvoice({ id: "ms-no-pm", payment_method_label: null, refundable_status: "refundable" })],
      { company_name: "ANN ECO CONSTRUCTION" },
    );
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText(/→ ANN ECO CONSTRUCTION/)).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT render arrow when refundable_status is null", async () => {
    setupFetchMock(
      [makeInvoice({ id: "ms-null", payment_method_label: "CB - TRUNG", refundable_status: null })],
      { company_name: "ANN ECO CONSTRUCTION" },
    );
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText(/→ ANN ECO CONSTRUCTION/)).toBeNull();
      },
      { timeout: 5000 },
    );
  });
});

describe("InvoicesPage — refund status stamps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
    setupAuthMock(false);
  });

  it("renders 'refundable' stamp for refundable status", async () => {
    setupFetchMock([makeInvoice({ refundable_status: "refundable" })], { company_name: "Co" });
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(
          within(desktop).queryByText("invoices.refund.status.refundable"),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("renders 'refund_pending' stamp for refund_pending status", async () => {
    setupFetchMock([makeInvoice({ refundable_status: "refund_pending" })], { company_name: "Co" });
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(
          within(desktop).queryByText("invoices.refund.status.refundPending"),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("renders 'refunded' stamp with positive class for refunded status", async () => {
    // Legacy row (refunded_by absent) still reads as company-refunded.
    setupFetchMock([makeInvoice({ refundable_status: "refunded" })], { company_name: "Co" });
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        const refundedStamp = within(desktop).queryByText("invoices.refundSource.company");
        expect(refundedStamp).not.toBeNull();
        expect(refundedStamp?.className).toContain("stamp positive");
      },
      { timeout: 5000 },
    );
  });

  it("names the bank — not the company — when refunded_by is 'bank'", async () => {
    setupFetchMock(
      [makeInvoice({ refundable_status: "refunded", refunded_by: "bank" })],
      { company_name: "Co" },
    );
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText("invoices.refundSource.bank")).not.toBeNull();
        expect(within(desktop).queryByText("invoices.refundSource.company")).toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("names both sides when refunded_by is 'both'", async () => {
    setupFetchMock(
      [makeInvoice({ refundable_status: "refunded", refunded_by: "both" })],
      { company_name: "Co" },
    );
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText("invoices.refundSource.both")).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT render refund stamp when refundable_status is null", async () => {
    setupFetchMock([makeInvoice({ refundable_status: null })]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        expect(within(desktop).queryByText("invoices.refund.status.refundable")).toBeNull();
        expect(within(desktop).queryByText("invoices.refund.status.refundPending")).toBeNull();
        expect(within(desktop).queryByText("invoices.refund.status.refunded")).toBeNull();
      },
      { timeout: 5000 },
    );
  });
});

describe("InvoicesPage — transfer to company payment action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
  });

  it("shows transfer button for M&S row with null refundable_status when canManageInvoices", async () => {
    setupAuthMock(true);
    setupFetchMock([makeInvoice({ type: "materials_services", refundable_status: null })]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        // aria-label is the i18n key via mock
        expect(
          within(desktop).queryByRole("button", { name: "invoices.refund.action.transfer" }),
        ).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("does NOT show transfer button when canManageInvoices is false", async () => {
    setupAuthMock(false);
    setupFetchMock([makeInvoice({ type: "materials_services", refundable_status: null })]);
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

  it("does NOT show transfer button for M&S row when refundable_status is already set", async () => {
    setupAuthMock(true);
    setupFetchMock([makeInvoice({ type: "materials_services", refundable_status: "refundable" })], {
      company_name: "Co",
    });
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

  it("does NOT show transfer button for non-M&S invoice types", async () => {
    setupAuthMock(true);
    setupFetchMock([makeInvoice({ type: "labor", refundable_status: null })]);
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

  it("calls setRefundableStatus('refundable') and reloads on click", async () => {
    setupAuthMock(true);
    mockSetRefundableStatus.mockResolvedValue(undefined);
    // First call returns the initial list, second call (after reload) returns empty
    mockFetchInvoicesWithMeta
      .mockResolvedValueOnce({
        invoices: [makeInvoice({ type: "materials_services", refundable_status: null })],
        total: 1,
        funds_released_total: 0,
        funds_released_company_total: 0,
        funds_released_personal_total: 0,
        company_spent_total: 0,
        personal_spent_total: 0,
        company_name: null,
      })
      .mockResolvedValue({
        invoices: [],
        total: 0,
        funds_released_total: 0,
        funds_released_company_total: 0,
        funds_released_personal_total: 0,
        company_spent_total: 0,
        personal_spent_total: 0,
        company_name: null,
      });

    render(<InvoicesPage />);

    const transferBtn = await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        return within(desktop).getByRole("button", { name: "invoices.refund.action.transfer" });
      },
      { timeout: 5000 },
    );

    fireEvent.click(transferBtn);

    await waitFor(
      () => {
        expect(mockSetRefundableStatus).toHaveBeenCalledWith("inv-base", "refundable");
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          "invoices.refund.transferSuccess",
        );
      },
      { timeout: 5000 },
    );
  });

  it("shows forbidden toast on 403", async () => {
    setupAuthMock(true);
    mockSetRefundableStatus.mockRejectedValue(new ApiError("Forbidden", 403));
    setupFetchMock([makeInvoice({ type: "materials_services", refundable_status: null })]);

    render(<InvoicesPage />);

    const transferBtn = await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        return within(desktop).getByRole("button", { name: "invoices.refund.action.transfer" });
      },
      { timeout: 5000 },
    );

    fireEvent.click(transferBtn);

    await waitFor(
      () => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          "invoices.refund.transferForbidden",
        );
      },
      { timeout: 5000 },
    );
  });

  it("shows generic error toast on non-403 failure", async () => {
    setupAuthMock(true);
    mockSetRefundableStatus.mockRejectedValue(new Error("Server error"));
    setupFetchMock([makeInvoice({ type: "materials_services", refundable_status: null })]);

    render(<InvoicesPage />);

    const transferBtn = await waitFor(
      () => {
        const desktop = screen.getByTestId("invoices-table-desktop");
        return within(desktop).getByRole("button", { name: "invoices.refund.action.transfer" });
      },
      { timeout: 5000 },
    );

    fireEvent.click(transferBtn);

    await waitFor(
      () => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          "invoices.refund.transferError",
        );
      },
      { timeout: 5000 },
    );
  });
});
