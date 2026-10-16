import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      if (!params) return full;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        full
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

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/components/invoices/invoice-mobile-card", () => ({
  InvoiceMobileCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="invoice-mobile-card">{children}</div>
  ),
}));


// ── Imports after mocks ───────────────────────────────────────────────────────

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import { toast } from "sonner";
import InvoicesPage from "../page";

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

const routerPush = vi.fn();
const routerReplace = vi.fn();

function setupMocks(invoices: Invoice[], query = "") {
  mockUseParams.mockReturnValue({ id: "proj-mg-1", locale: "en" });
  const params = new URLSearchParams(query);
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: (k: string) => params.get(k), toString: () => params.toString() } as any
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: routerPush, replace: routerReplace, refresh: vi.fn() } as any
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-mg-1/invoices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices,
    total: invoices.length,
    funds_released_total: 0,
    funds_released_company_total: 0,
    funds_released_personal_total: 0,
    company_spent_total: 0,
    personal_spent_total: 0,
    company_name: null,
  });
}

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-mg-1",
    project_id: "proj-mg-1",
    invoice_number: "ARC-2026-0001",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 100,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    worker_id: null,
    ...overrides,
  };
}


/**
 * Every chart opens the Expense list on what it adds up: ?type=, ?month= and
 * ?purse= filter the ledger, say so in a chip with a way back, and an
 * ?invoice= link to an expense that is gone says so.
 */
function fixture(): Invoice[] {
  return [
    makeInvoice({ id: "sep-mat-perso", invoice_number: "ARC-1", issue_date: "2026-09-03", paid_by_personal: true, recipient_name: "Perso Sept" }),
    makeInvoice({ id: "sep-mat-none", invoice_number: "ARC-2", issue_date: "2026-09-10", recipient_name: "Nobody Sept" }),
    makeInvoice({ id: "oct-mat-co", invoice_number: "ARC-3", issue_date: "2026-10-02", paid_by_company: true, recipient_name: "Company Oct" }),
    makeInvoice({ id: "sep-labor", invoice_number: "LAB-1", type: "labor", issue_date: "2026-10-05", service_month: "2026-09-01", worker_id: "w1", recipient_name: "Worker Sept" }),
  ];
}

const desktop = () => screen.getByTestId("invoices-table-desktop");

describe("InvoicesPage — URL filters from charts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only the month asked for, with a chip to show everything again", async () => {
    setupMocks(fixture(), "month=2026-09");
    render(<InvoicesPage />);
    await waitFor(() => expect(within(desktop()).getByText("Perso Sept")).toBeInTheDocument());
    expect(within(desktop()).getByText("Nobody Sept")).toBeInTheDocument();
    expect(within(desktop()).getByText("Worker Sept")).toBeInTheDocument();
    expect(within(desktop()).queryByText("Company Oct")).toBeNull();

    const chips = screen.getByTestId("expense-filter-chips");
    fireEvent.click(within(chips).getByText("invoices.filters.clear"));
    expect(routerReplace).toHaveBeenCalledWith("/en/projects/proj-mg-1/invoices", { scroll: false });
  });

  it("combines a type tab, a month and a purse", async () => {
    setupMocks(fixture(), "type=materials_services&month=2026-09&purse=none");
    render(<InvoicesPage />);
    await waitFor(() => expect(within(desktop()).getByText("Nobody Sept")).toBeInTheDocument());
    expect(within(desktop()).queryByText("Perso Sept")).toBeNull();
    expect(within(desktop()).queryByText("Worker Sept")).toBeNull();
    expect(screen.getByText("invoices.filters.purse.none")).toBeInTheDocument();
  });

  it("writes a tab click back to the URL, keeping the other filters", async () => {
    setupMocks(fixture(), "month=2026-09");
    render(<InvoicesPage />);
    await waitFor(() => expect(within(desktop()).getByText("Perso Sept")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "invoices.types.labor" }));
    expect(routerReplace).toHaveBeenCalledWith("/en/projects/proj-mg-1/invoices?month=2026-09&type=labor", {
      scroll: false,
    });
  });

  it("says an expense opened by link no longer exists", async () => {
    setupMocks(fixture(), "invoice=gone");
    render(<InvoicesPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("invoices.invoiceNotFound"));
    expect(routerReplace).toHaveBeenCalledWith("/en/projects/proj-mg-1/invoices", { scroll: false });
  });

  it("tells a restricted member the list is their own payments", async () => {
    setupMocks([], "");
    mockFetchInvoicesWithMeta.mockResolvedValue({
      invoices: [],
      total: 0,
      funds_released_total: 0,
      company_spent_total: 0,
      company_name: null,
      restricted: true,
    });
    render(<InvoicesPage />);
    expect(await screen.findByTestId("restricted-expenses-banner")).toHaveTextContent("invoices.restricted.banner");
    expect(screen.getByText("invoices.restricted.empty")).toBeInTheDocument();
    expect(screen.queryByText("invoices.noInvoices")).toBeNull();
  });
});
