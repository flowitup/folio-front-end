/**
 * Tests for InvoicesPage — company-paid expenses: funds-released ratio card.
 *
 * Covers:
 * - Funds released card ratio reads from company_spent_total (not refunded)
 *
 * Transfer-action visibility gating (paid_by_company) used to be tested here
 * against the flat table's row-level button; that button now lives inside
 * InvoiceDetailRow (opened on row click) — see
 * invoice-detail-content-paid-by-company.test.tsx for that coverage, and
 * transfer-to-company-payment-action.test.tsx for the click behavior itself.
 *
 * Dual-render note: jsdom renders both mobile and desktop views.
 * Desktop assertions are scoped via data-testid="invoices-table-desktop".
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
