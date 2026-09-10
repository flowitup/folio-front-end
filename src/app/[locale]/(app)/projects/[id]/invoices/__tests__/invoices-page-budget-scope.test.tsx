/**
 * Tests for InvoicesPage — the financing side is gated on `project:view_budget`.
 *
 * A company manager runs the spend side of a project but not what funds it, so
 * without the permission the page must not offer the released-funds tab, the
 * two-purses card, or the bank draw-down chart. The expense ledger itself is
 * untouched — this is a narrowing, not a blackout.
 *
 * The backend already strips the released rows and zeroes their aggregates for
 * such a caller; these specs cover the UI half, so nothing renders as an empty
 * card or a dial drawn against zero.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
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
  InvoiceMobileCard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="invoice-mobile-card">{children}</div>
  ),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
  useParams,
  useSearchParams,
  useRouter,
  usePathname,
} from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchInvoicesWithMeta } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

const EXPENSE: Invoice = {
  id: "inv-bs-1",
  project_id: "proj-bs-1",
  invoice_number: "INV-2026-0001",
  type: "materials_services",
  issue_date: "2026-06-01",
  recipient_name: "Supplier X",
  recipient_address: null,
  notes: null,
  items: [
    {
      description: "Cement bags",
      quantity: 10,
      unit_price: 100,
      total: 1000,
      vat_rate: 20,
    },
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
};

function setupMocks(permissions: string[]) {
  mockUseParams.mockReturnValue({ id: "proj-bs-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-bs-1/invoices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions } } as any);
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices: [EXPENSE],
    total: 1,
    // What the backend returns to a caller without the permission: the release
    // rows are gone and every financing total is zero.
    funds_released_total: 0,
    funds_released_company_total: 0,
    funds_released_personal_total: 0,
    company_spent_total: 1200,
    personal_spent_total: 0,
    company_name: "ACME SARL",
  });
}

describe("InvoicesPage — financing side without project:view_budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers no released-funds tab", async () => {
    setupMocks([]);
    render(<InvoicesPage />);

    await waitFor(() => expect(mockFetchInvoicesWithMeta).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", {
        name: /invoices\.types\.released_funds/i,
      }),
    ).not.toBeInTheDocument();
    // The spend tabs are all still there.
    expect(
      screen.getByRole("button", {
        name: /invoices\.types\.materials_services/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /invoices\.types\.labor/i }),
    ).toBeInTheDocument();
  });

  it("hides the two-purses card and the bank draw-down", async () => {
    setupMocks([]);
    render(<InvoicesPage />);

    await waitFor(() => expect(mockFetchInvoicesWithMeta).toHaveBeenCalled());
    expect(
      screen.queryByTestId("expense-purses-summary"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("invoices.summary.companyPurse"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("invoices.summary.personalPurse"),
    ).not.toBeInTheDocument();
  });

  it("still lists the project's expenses", async () => {
    setupMocks([]);
    render(<InvoicesPage />);

    await waitFor(() => expect(mockFetchInvoicesWithMeta).toHaveBeenCalled());
    expect(await screen.findAllByText("INV-2026-0001")).not.toHaveLength(0);
  });

  it("restores every financing surface once the permission is granted", async () => {
    setupMocks(["project:view_budget"]);
    render(<InvoicesPage />);

    await waitFor(() => expect(mockFetchInvoicesWithMeta).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: /invoices\.types\.released_funds/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("expense-purses-summary"),
    ).toBeInTheDocument();
  });
});
