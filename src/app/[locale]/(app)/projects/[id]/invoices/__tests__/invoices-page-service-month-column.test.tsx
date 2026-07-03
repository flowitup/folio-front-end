/**
 * Tests for InvoicesPage — labor "payment for month" (service_month) column
 *
 * Covers:
 * - Month column header appears on the labor tab only
 * - Month column is absent on the "all" and other type tabs
 * - Month cell shows the localized "Month Year" label when service_month is set
 * - Month cell shows "—" when service_month is null
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

function setupMocks(invoices: Invoice[]) {
  mockUseParams.mockReturnValue({ id: "proj-sm-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-sm-1/invoices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices,
    total: invoices.length,
    funds_released_total: 0,
    company_spent_total: 0,
    company_name: null,
  });
}

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-sm-1",
    project_id: "proj-sm-1",
    invoice_number: "INV-2026-0099",
    type: "labor",
    issue_date: "2026-06-01",
    recipient_name: "Worker Co",
    recipient_address: null,
    notes: null,
    items: [{ description: "June labor", quantity: 1, unit_price: 1000, total: 1000 }],
    total_amount: 1000,
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

describe("InvoicesPage — service_month column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the Month column header on the labor tab", async () => {
    setupMocks([makeInvoice({ type: "labor" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.serviceMonth")).not.toBeNull();
    });
  });

  it("does NOT show the Month column header on the materials_services tab", async () => {
    setupMocks([makeInvoice({ type: "materials_services", service_month: null })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.materials_services/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.serviceMonth")).toBeNull();
    });
  });

  it("does NOT show the Month column header on the all tab", async () => {
    setupMocks([makeInvoice({})]);
    render(<InvoicesPage />);

    // "All" is the default tab — no need to click
    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.serviceMonth")).toBeNull();
    });
  });

  it("renders the localized month/year when service_month is set", async () => {
    setupMocks([makeInvoice({ type: "labor", service_month: "2026-06-01" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("June 2026")).not.toBeNull();
    });
  });

  it("renders '—' in the Month cell when service_month is null", async () => {
    setupMocks([makeInvoice({ type: "labor", service_month: null })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      const dashes = within(desktop).queryAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
