/**
 * Tests for InvoicesPage — desktop-table avoir-return markers.
 *
 * Covers:
 * - AVOIR badge shown next to the return type stamp when settled_via='avoir'
 * - "Applied to {number}" sub-label shown when applied_to_invoice_number present
 * - Outstanding-avoir stamp shown for an avoir return with no applied link
 * - None of the above render for a cash-settled return
 *
 * Dual-render note: jsdom renders both mobile cards and desktop table.
 * Desktop table assertions are scoped via data-testid="invoices-table-desktop"
 * (InvoiceMobileCard is stubbed out — its own markers are covered by
 * invoice-avoir-badges.test.tsx as a real-component test).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks (hoisted before dynamic imports) ─────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      // Keys whose real message template carries a {placeholder} — resolved
      // to the template (not the raw key path) so param substitution works.
      const templates: Record<string, string> = {
        "appliedTo": "Applied to {number}",
      };
      const full = namespace ? `${namespace}.${key}` : key;
      const template = templates[key] ?? full;
      if (!params) return template;
      return Object.entries(params).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        template,
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
  InvoiceMobileCard: () => <div data-testid="invoice-mobile-card" />,
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

function setupNavigationMocks() {
  mockUseParams.mockReturnValue({ id: "proj-avoir-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-avoir-1/invoices");
}

function setupAuthMock() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
}

function setupFetchMock(invoices: Invoice[]) {
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

function makeReturnInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "ret-base",
    project_id: "proj-avoir-1",
    invoice_number: "ARC-2026-0001",
    type: "return",
    issue_date: "2026-05-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Credit", quantity: 1, unit_price: -100, total: -100 }],
    total_amount: -100,
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

describe("InvoicesPage — desktop avoir markers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNavigationMocks();
    setupAuthMock();
  });

  it("shows the AVOIR badge for a settled_via='avoir' return", async () => {
    setupFetchMock([makeReturnInvoice({ settled_via: "avoir" })]);
    render(<InvoicesPage />);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByTestId("avoir-badge-desktop")).not.toBeNull();
    });
  });

  it("does NOT show the AVOIR badge for a cash-settled return", async () => {
    setupFetchMock([makeReturnInvoice({ settled_via: "cash" })]);
    render(<InvoicesPage />);

    await waitFor(() => screen.getByTestId("invoices-table-desktop"));
    const desktop = screen.getByTestId("invoices-table-desktop");
    expect(within(desktop).queryByTestId("avoir-badge-desktop")).toBeNull();
  });

  it("shows the 'Applied to {number}' sub-label when applied_to_invoice_number is present", async () => {
    setupFetchMock([
      makeReturnInvoice({
        settled_via: "avoir",
        applied_to_invoice_id: "target-1",
        applied_to_invoice_number: "FR-2026-0042",
      }),
    ]);
    render(<InvoicesPage />);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      const label = within(desktop).queryByTestId("applied-to-label-desktop");
      expect(label).not.toBeNull();
      expect(label?.textContent).toContain("FR-2026-0042");
    });
  });

  it("shows the outstanding-avoir stamp for an unlinked avoir return", async () => {
    setupFetchMock([
      makeReturnInvoice({ settled_via: "avoir", applied_to_invoice_id: null }),
    ]);
    render(<InvoicesPage />);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByTestId("outstanding-avoir-stamp-desktop")).not.toBeNull();
      expect(within(desktop).queryByTestId("applied-to-label-desktop")).toBeNull();
    });
  });

  it("does NOT show the outstanding-avoir stamp once applied to an invoice", async () => {
    setupFetchMock([
      makeReturnInvoice({
        settled_via: "avoir",
        applied_to_invoice_id: "target-1",
        applied_to_invoice_number: "FR-2026-0042",
      }),
    ]);
    render(<InvoicesPage />);

    await waitFor(() => {
      const desktop = screen.getByTestId("invoices-table-desktop");
      expect(within(desktop).queryByTestId("outstanding-avoir-stamp-desktop")).toBeNull();
    });
  });
});
