/**
 * Tests for InvoicesPage — company/personal released-funds split cards.
 *
 * Covers:
 * - Company card renders companySpentTotal / fundsReleasedCompanyTotal with the
 *   fundsReleasedCompany label and companySpentOfReleasedCompany caption
 * - Personal card renders personalSpentTotal / fundsReleasedPersonalTotal with the
 *   fundsReleasedPersonal label and personalSpentOfReleasedPersonal caption
 * - Company card's invoice count excludes paid_by_personal rows
 * - Personal card's invoice count only includes paid_by_personal rows
 *
 * Dual-render note: jsdom renders both mobile and desktop views; the KPI cards
 * are not part of the dual-render split, so plain screen queries are safe here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  // Params are appended as a JSON suffix (rather than interpolated into the
  // key text) so tests can assert on the exact `n` passed to invoiceCount
  // without depending on real plural-message formatting.
  useTranslations: (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const full = namespace ? `${namespace}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
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
  mockUseParams.mockReturnValue({ id: "proj-split-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-split-1/invoices");
}

function setupAuth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
}

function setupFetch(
  invoices: Invoice[],
  meta?: {
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
    funds_released_total: 0,
    funds_released_company_total: meta?.funds_released_company_total ?? 0,
    funds_released_personal_total: meta?.funds_released_personal_total ?? 0,
    company_spent_total: meta?.company_spent_total ?? 0,
    personal_spent_total: meta?.personal_spent_total ?? 0,
    company_name: meta?.company_name ?? null,
  });
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-split-1",
    project_id: "proj-split-1",
    invoice_number: "INV-2026-0001",
    type: "released_funds",
    issue_date: "2026-06-01",
    recipient_name: "Bank",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 1000,
    created_by: "user-1",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: true,
    refundable_status: null,
    service_month: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupNavigation();
  setupAuth();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoicesPage — company released-funds card", () => {
  it("renders companySpentTotal / fundsReleasedCompanyTotal with the company caption", async () => {
    setupFetch([], {
      funds_released_company_total: 80000,
      company_spent_total: 30000,
      company_name: "ACME",
    });
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.queryByText("invoices.fundsReleasedCompany")).not.toBeNull();
      expect(screen.queryByText("invoices.refund.companySpentOfReleasedCompany")).not.toBeNull();
    });

    const card = screen.getByText("invoices.fundsReleasedCompany").closest(".folio-card");
    expect(card?.textContent).toMatch(/30[^\d]*000/);
    expect(card?.textContent).toMatch(/80[^\d]*000/);
  });

  it("counts only non-personal released rows", async () => {
    setupFetch([
      makeInvoice({ id: "rf-company-1", paid_by_personal: false }),
      makeInvoice({ id: "rf-company-2" }), // absent => company
      makeInvoice({ id: "rf-personal-1", paid_by_personal: true }),
    ]);
    render(<InvoicesPage />);

    const companyCard = await waitFor(() => {
      const el = screen.getByText("invoices.fundsReleasedCompany").closest(".folio-card");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // 2 company rows (paid_by_personal=false or absent), the 3rd is personal.
    expect(companyCard.textContent).toContain('invoices.invoiceCount({"n":2})');
  });
});

describe("InvoicesPage — personal released-funds card", () => {
  it("renders personalSpentTotal / fundsReleasedPersonalTotal with the personal caption", async () => {
    setupFetch([], {
      funds_released_personal_total: 5000,
      personal_spent_total: 1200,
      company_name: "ACME",
    });
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.queryByText("invoices.fundsReleasedPersonal")).not.toBeNull();
      expect(screen.queryByText("invoices.refund.personalSpentOfReleasedPersonal")).not.toBeNull();
    });

    const card = screen.getByText("invoices.fundsReleasedPersonal").closest(".folio-card");
    expect(card?.textContent).toMatch(/1[^\d]*200/);
    expect(card?.textContent).toMatch(/5[^\d]*000/);
  });

  it("counts only paid_by_personal released rows", async () => {
    setupFetch([
      makeInvoice({ id: "rf-company-1", paid_by_personal: false }),
      makeInvoice({ id: "rf-personal-1", paid_by_personal: true }),
      makeInvoice({ id: "rf-personal-2", paid_by_personal: true }),
    ]);
    render(<InvoicesPage />);

    const personalCard = await waitFor(() => {
      const el = screen.getByText("invoices.fundsReleasedPersonal").closest(".folio-card");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });

    // 2 personal rows (paid_by_personal=true), the 1st is company.
    expect(personalCard.textContent).toContain('invoices.invoiceCount({"n":2})');
  });
});
