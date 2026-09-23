/**
 * Tests for InvoicesPage — a company cash advance is stored as a released_funds
 * row but listed under "Others": the Released Funds tab leaves it out, the
 * Others tab lists it, and the page still reads one unfiltered fetch so the
 * purses summary keeps counting it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv",
    project_id: "proj-ca-1",
    invoice_number: "INV-0",
    type: "others",
    issue_date: "2026-06-01",
    recipient_name: "Someone",
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
    ...overrides,
  };
}

const ADVANCE = makeInvoice({
  id: "adv",
  invoice_number: "ADV-0001",
  type: "released_funds",
  is_cash_advance: true,
  total_amount: 500,
});
const RELEASE = makeInvoice({
  id: "rel",
  invoice_number: "REL-0001",
  type: "released_funds",
  total_amount: 10000,
});
const OTHER = makeInvoice({ id: "oth", invoice_number: "OTH-0001", total_amount: 40 });

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ id: "proj-ca-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-ca-1/invoices");
  mockUseAuth.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { user: { permissions: ["project:view_budget", "project:manage_invoices"] } } as any,
  );
  mockFetchInvoicesWithMeta.mockResolvedValue({
    invoices: [ADVANCE, RELEASE, OTHER],
    total: 3,
    funds_released_total: 10000,
    funds_released_company_total: 10000,
    funds_released_personal_total: 0,
    company_spent_total: 40,
    personal_spent_total: 0,
    company_cash_advanced_total: 500,
    company_name: "ACME SARL",
  });
});

async function openTab(label: string) {
  render(<InvoicesPage />);
  await waitFor(() => expect(screen.getAllByText("REL-0001").length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("InvoicesPage — cash advances listed under Others", () => {
  it("Released Funds tab leaves the cash advance out", async () => {
    await openTab("invoices.types.released_funds");
    await waitFor(() => expect(screen.queryAllByText("ADV-0001")).toHaveLength(0));
    expect(screen.getAllByText("REL-0001").length).toBeGreaterThan(0);
  });

  it("Others tab lists the cash advance next to plain others", async () => {
    await openTab("invoices.types.others");
    await waitFor(() => expect(screen.queryAllByText("REL-0001")).toHaveLength(0));
    expect(screen.getAllByText("ADV-0001").length).toBeGreaterThan(0);
    expect(screen.getAllByText("OTH-0001").length).toBeGreaterThan(0);
  });

  it("fetches the unfiltered list once and switches tabs without refetching", async () => {
    await openTab("invoices.types.others");
    await waitFor(() => expect(screen.getAllByText("ADV-0001").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "invoices.types.released_funds" }));
    await waitFor(() => expect(screen.queryAllByText("ADV-0001")).toHaveLength(0));
    expect(mockFetchInvoicesWithMeta).toHaveBeenCalledTimes(1);
    expect(mockFetchInvoicesWithMeta).toHaveBeenCalledWith("proj-ca-1");
  });
});
