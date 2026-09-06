/**
 * Tests for InvoicesPage — TVA column visibility
 *
 * Covers:
 * - TVA column header appears on released_funds, materials_services, others tabs
 * - TVA column is absent on the "all" and "labor" tabs
 * - TVA cell shows computed amount when items have a non-zero vat_rate
 * - TVA cell shows "—" when no items have VAT
 *
 * Dual-render note: jsdom renders both mobile cards and the desktop table.
 * Assertions on the desktop table are scoped via data-testid="invoices-table-desktop"
 * to avoid false positives from the mobile card layout.
 */

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

vi.mock("@/components/invoices/invoice-mobile-card", () => ({
  InvoiceMobileCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="invoice-mobile-card">{children}</div>
  ),
}));


// ── Imports after mocks ───────────────────────────────────────────────────────

import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";
import { formatEUR } from "@/lib/utils/formatters";
// formatEUR emits U+202F/U+00A0 spaces; testing-library's default normalizer
// collapses them to ASCII spaces, so match against the normalized string.
const eur = (n: number) => formatEUR(n).replace(/[\u202f\u00a0]/g, " ");


const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

function setupMocks(invoices: Invoice[]) {
  mockUseParams.mockReturnValue({ id: "proj-tva-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-tva-1/invoices");
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
    id: "inv-tva-1",
    project_id: "proj-tva-1",
    invoice_number: "INV-2026-0099",
    type: "materials_services",
    issue_date: "2026-06-01",
    recipient_name: "Supplier X",
    recipient_address: null,
    notes: null,
    items: [
      { description: "Cement bags", quantity: 10, unit_price: 100, total: 1000, vat_rate: 20 },
    ],
    total_amount: 1200,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: null,
    ...overrides,
  };
}

describe("InvoicesPage — TVA column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the TVA column header on the materials_services tab", async () => {
    setupMocks([makeInvoice({ type: "materials_services" })]);
    render(<InvoicesPage />);

    // Switch to materials_services tab
    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.materials_services/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.colTva")).not.toBeNull();
    });
  });

  it("shows the TVA column header on the released_funds tab", async () => {
    setupMocks([makeInvoice({ type: "released_funds" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.released_funds/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.colTva")).not.toBeNull();
    });
  });

  it("shows the TVA column header on the others tab", async () => {
    setupMocks([makeInvoice({ type: "others" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.others/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.colTva")).not.toBeNull();
    });
  });

  it("does NOT show the TVA column header on the labor tab", async () => {
    setupMocks([makeInvoice({ type: "labor" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.colTva")).toBeNull();
    });
  });

  it("does NOT show the TVA column header on the all tab", async () => {
    setupMocks([makeInvoice({})]);
    render(<InvoicesPage />);

    // "All" is the default tab — no need to click
    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.colTva")).toBeNull();
    });
  });

  it("renders computed TVA amount when invoice items have vat_rate > 0", async () => {
    // 10 × 100 × 20% = 200.00
    setupMocks([
      makeInvoice({
        type: "materials_services",
        items: [{ description: "Item", quantity: 10, unit_price: 100, total: 1000, vat_rate: 20 }],
      }),
    ]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.materials_services/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      // TVA cell = 200.00
      expect(within(desktop).queryByText(eur(200))).not.toBeNull();
    });
  });

  it("renders '—' in the TVA cell when all items have vat_rate = 0", async () => {
    setupMocks([
      makeInvoice({
        type: "materials_services",
        items: [{ description: "No VAT item", quantity: 5, unit_price: 50, total: 250, vat_rate: 0 }],
      }),
    ]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.materials_services/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      const dashes = within(desktop).queryAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
