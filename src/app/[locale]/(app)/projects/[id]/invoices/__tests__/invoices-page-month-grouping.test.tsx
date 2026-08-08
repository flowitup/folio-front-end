/**
 * Tests for InvoicesPage — month-grouped "All" tab
 *
 * The "all" tab groups the ledger by month (newest first, header = localized
 * month label + net subtotal), with per-type category sections inside each
 * month. Labor invoices bucket under their service_month (fallback
 * issue_date) and render as FLAT standard rows (recipient = worker-name
 * snapshot) — the per-worker accordion is gone from the "all" tab but stays
 * on the labor tab.
 *
 * Dual-render note: jsdom renders both mobile cards and the desktop table.
 * Desktop assertions are scoped via data-testid="invoices-table-desktop".
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
import { formatEUR } from "@/lib/utils/formatters";
import InvoicesPage from "../page";

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

const routerPush = vi.fn();

function setupMocks(invoices: Invoice[]) {
  mockUseParams.mockReturnValue({ id: "proj-mg-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: routerPush, replace: vi.fn(), refresh: vi.fn() } as any
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

/** Two months of mixed data; the labor invoice is July-issued but pays for June. */
function fixture(): Invoice[] {
  return [
    makeInvoice({
      id: "july-mat",
      invoice_number: "ARC-2026-0100",
      issue_date: "2026-07-03",
      total_amount: 10,
    }),
    makeInvoice({
      id: "june-mat",
      invoice_number: "ARC-2026-0050",
      issue_date: "2026-06-20",
      total_amount: 50,
    }),
    makeInvoice({
      id: "june-ret",
      invoice_number: "ARC-2026-0060",
      type: "return",
      issue_date: "2026-06-25",
      total_amount: -20,
    }),
    makeInvoice({
      id: "june-pay",
      invoice_number: "LAB-2026-0001",
      type: "labor",
      issue_date: "2026-07-18",
      service_month: "2026-06-01",
      worker_id: "w1",
      recipient_name: "Tiến",
      total_amount: 25,
    }),
  ];
}

describe("InvoicesPage — month-grouped all tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders month sections newest-first with localized labels and net subtotals", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByTestId("invoices-month-header-desktop-2026-07");

    const headers = within(desktop).getAllByTestId(/^invoices-month-header-desktop-/);
    expect(headers.map((h) => h.getAttribute("data-testid"))).toEqual([
      "invoices-month-header-desktop-2026-07",
      "invoices-month-header-desktop-2026-06",
    ]);

    // July: 10 (materials) + 25 labor? — no: the labor invoice pays for June.
    expect(headers[0].textContent).toContain("July 2026");
    expect(headers[0].textContent).toContain(formatEUR(10));
    // June nets materials 50 + labor 25 + return -20 = 55.
    expect(headers[1].textContent).toContain("June 2026");
    expect(headers[1].textContent).toContain(formatEUR(55));
  });

  it("buckets the July-issued June-service labor invoice under June, as a flat row with the worker name", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByText("LAB-2026-0001");

    // Flat standard row: worker-name snapshot visible, no by-worker accordion.
    expect(within(desktop).queryByTestId("labor-by-worker-desktop")).toBeNull();
    expect(within(desktop).queryByText("Tiến")).not.toBeNull();

    // DOM order proves the bucketing: July header → July row → June header → labor row.
    const text = desktop.textContent ?? "";
    const idxJuly = text.indexOf("July 2026");
    const idxJulyRow = text.indexOf("ARC-2026-0100");
    const idxJune = text.indexOf("June 2026");
    const idxLabor = text.indexOf("LAB-2026-0001");
    expect(idxJuly).toBeGreaterThanOrEqual(0);
    expect(idxJulyRow).toBeGreaterThan(idxJuly);
    expect(idxJune).toBeGreaterThan(idxJulyRow);
    expect(idxLabor).toBeGreaterThan(idxJune);
  });

  it("orders category stamps canonically inside a month and skips empty categories", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByTestId("invoices-month-header-desktop-2026-06");

    const text = desktop.textContent ?? "";
    const idxJune = text.indexOf("June 2026");
    // June holds labor → materials_services → return, in canonical order.
    const idxLaborStamp = text.indexOf("invoices.types.labor", idxJune);
    const idxMatStamp = text.indexOf("invoices.types.materials_services", idxJune);
    const idxRetStamp = text.indexOf("invoices.types.return", idxJune);
    expect(idxLaborStamp).toBeGreaterThan(idxJune);
    expect(idxMatStamp).toBeGreaterThan(idxLaborStamp);
    expect(idxRetStamp).toBeGreaterThan(idxMatStamp);
    // No released_funds / others invoices in June → stamps absent after the header.
    expect(text.indexOf("invoices.types.released_funds", idxJune)).toBe(-1);
    expect(text.indexOf("invoices.types.others", idxJune)).toBe(-1);
  });

  it("mirrors the month structure in the mobile card list", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    await screen.findByTestId("invoices-month-header-mobile-2026-07");
    const mobileJune = await screen.findByTestId("invoices-month-header-mobile-2026-06");
    expect(mobileJune.textContent).toContain("June 2026");
    expect(mobileJune.textContent).toContain(formatEUR(55));
  });

  it("keeps the labor tab's by-worker accordion untouched", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    await screen.findByTestId("invoices-table-desktop");
    fireEvent.click(screen.getByRole("button", { name: /invoices\.types\.labor$/i }));

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByTestId("labor-by-worker-desktop")).not.toBeNull();
      expect(
        within(desktop).queryByTestId(/^invoices-month-header-desktop-/)
      ).toBeNull();
    });
  });

  it("stamps desktop labor rows with their service month so cross-month bucketing is explained", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    const stamp = await within(desktop).findByTestId("labor-service-month-desktop");
    expect(stamp.textContent).toBe("June 2026");
  });

  it("exposes month headers as headings for screen-reader navigation", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByTestId("invoices-month-header-desktop-2026-06");
    expect(
      within(desktop).getByRole("heading", { name: "June 2026" })
    ).not.toBeNull();
    expect(
      within(desktop).getByRole("heading", { name: "July 2026" })
    ).not.toBeNull();
  });

  it("collapses a month via its header toggle (rows + stamps hidden, subtotal kept) and restores it on re-click", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByText("LAB-2026-0001");

    const juneToggle = within(desktop).getByRole("button", { name: "June 2026" });
    expect(juneToggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(juneToggle);
    expect(juneToggle.getAttribute("aria-expanded")).toBe("false");
    // June contents hidden…
    expect(within(desktop).queryByText("LAB-2026-0001")).toBeNull();
    expect(within(desktop).queryByText("ARC-2026-0050")).toBeNull();
    expect(within(desktop).queryByText("invoices.types.return")).toBeNull();
    // …but the header keeps the subtotal, and July is untouched.
    const juneHeader = within(desktop).getByTestId("invoices-month-header-desktop-2026-06");
    expect(juneHeader.textContent).toContain(formatEUR(55));
    expect(within(desktop).queryByText("ARC-2026-0100")).not.toBeNull();

    fireEvent.click(juneToggle);
    expect(within(desktop).queryByText("LAB-2026-0001")).not.toBeNull();
  });

  it("collapse state is shared with the mobile list (one page-level state, dual render)", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByText("LAB-2026-0001");

    fireEvent.click(within(desktop).getByRole("button", { name: "June 2026" }));
    // The mobile June header's toggle reflects the same collapsed state.
    const mobileJune = screen.getByTestId("invoices-month-header-mobile-2026-06");
    expect(
      within(mobileJune).getByRole("button", { name: "June 2026" }).getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("re-expands a collapsed month when a deep-link selects one of its invoices", async () => {
    setupMocks(fixture());
    const { rerender } = render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    await within(desktop).findByText("LAB-2026-0001");
    fireEvent.click(within(desktop).getByRole("button", { name: "June 2026" }));
    expect(within(desktop).queryByText("LAB-2026-0001")).toBeNull();

    // Simulate ?invoice=june-pay arriving (URL paste / back button).
    mockUseSearchParams.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { get: (k: string) => (k === "invoice" ? "june-pay" : null), toString: () => "invoice=june-pay" } as any
    );
    rerender(<InvoicesPage />);

    await waitFor(() => {
      expect(within(desktop).queryByText("LAB-2026-0001")).not.toBeNull();
    });
  });

  it("opens the inline detail from a flat labor row via the ?invoice= URL toggle", async () => {
    setupMocks(fixture());
    render(<InvoicesPage />);

    const desktop = await screen.findByTestId("invoices-table-desktop");
    const laborCell = await within(desktop).findByText("LAB-2026-0001");
    const row = laborCell.closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(row!);

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(
        expect.stringContaining("invoice=june-pay"),
        expect.anything()
      );
    });
  });
});
