/**
 * Tests for InvoicesPage — labor "payment for month" (service_month) display
 *
 * Phase 09 replaced the labor tab's flat table (with a per-row Month
 * column) with the worker-grouped LaborInvoicesByWorker accordion, whose
 * expanded history groups invoices under service_month headers instead —
 * the per-row Month cell/column is gone by design (redundant under
 * headers). This file was updated accordingly; see
 * labor-invoices-by-worker.test.tsx for the grouping component's own
 * dedicated unit coverage (month order, no-month-last, totals, etc.).
 *
 * Covers:
 * - The flat table's Month column never renders (not on labor, materials_services,
 *   or "all" — the header cell was removed entirely, not just hidden per-tab)
 * - The labor tab renders the grouped accordion instead of the flat table
 * - Expanding a worker group shows the localized "Month Year" header when
 *   service_month is set, and the "No month" header when it's null
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
    funds_released_company_total: 0,
    funds_released_personal_total: 0,
    company_spent_total: 0,
    personal_spent_total: 0,
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

  it("labor tab renders the worker-grouped view instead of the flat table (no serviceMonth column header anywhere)", async () => {
    setupMocks([makeInvoice({ type: "labor" })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByText("invoices.serviceMonth")).toBeNull();
      expect(within(desktop).queryByTestId("labor-by-worker-desktop")).not.toBeNull();
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

  it("shows the localized month/year as the worker group's last-payment chip when service_month is set", async () => {
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

  it("groups a service_month-less labor invoice under the 'No month' history header once its worker group expands", async () => {
    setupMocks([makeInvoice({ type: "labor", service_month: null })]);
    render(<InvoicesPage />);

    await waitFor(() => expect(screen.queryByText("invoices.noInvoices")).toBeNull());

    const tabBtn = screen.getByRole("button", { name: /invoices\.types\.labor/i });
    fireEvent.click(tabBtn);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    // worker_id is unset on this fixture, so the invoice lands in the
    // Unassigned group — expand it to reveal the month-grouped history.
    const group = await within(desktop).findByTestId("labor-by-worker-group-desktop-unassigned");
    fireEvent.click(group.querySelector("button")!);

    await waitFor(() => {
      expect(within(desktop).queryByText("invoices.byWorker.noMonthGroup")).not.toBeNull();
    });
  });
});
