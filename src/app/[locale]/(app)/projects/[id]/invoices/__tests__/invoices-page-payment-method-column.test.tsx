/**
 * Tests for InvoicesPage — payment method column
 *
 * Covers:
 * - Column header "paymentMethod.label" renders in the table
 * - Built-in "Cash" snapshot is routed through localizeMethodLabel and
 *   resolves to the "cash" key under the paymentMethods.builtins namespace
 * - Custom user labels pass through unchanged
 * - Em-dash renders for null / empty / whitespace-only payment_method_label
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";

// ── Module mocks (must be hoisted before dynamic imports) ─────────────────────

vi.mock("next-intl", () => ({
  // Returns the key prefixed with its namespace so DOM assertions can
  // verify which translator scope produced a given string. Interpolates
  // {param} placeholders to mirror the sibling test's mock contract.
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

const mockUseParams = vi.mocked(useParams);
const mockUseSearchParams = vi.mocked(useSearchParams);
const mockUseRouter = vi.mocked(useRouter);
const mockUsePathname = vi.mocked(usePathname);
const mockUseAuth = vi.mocked(useAuth);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);

function setupMocks(invoices: Invoice[]) {
  mockUseParams.mockReturnValue({ id: "proj-test-1", locale: "en" });
  mockUseSearchParams.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { get: () => null, toString: () => "" } as any,
  );
  mockUseRouter.mockReturnValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() } as any,
  );
  mockUsePathname.mockReturnValue("/en/projects/proj-test-1/invoices");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockUseAuth.mockReturnValue({ user: { permissions: [] } } as any);
  mockFetchInvoicesWithMeta.mockResolvedValue({ invoices, total: invoices.length, funds_released_total: 0 });
}

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-test-1",
    invoice_number: "INV-2026-0001",
    type: "released_funds",
    issue_date: "2026-05-12",
    recipient_name: "Acme Corp",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 400,
    created_by: "user-1",
    created_at: "2026-05-12T00:00:00Z",
    updated_at: "2026-05-12T00:00:00Z",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    ...overrides,
  };
}

describe("InvoicesPage — payment method column", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Payment method column header", async () => {
    setupMocks([makeInvoice({})]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("invoices.paymentMethod.label")).toBeDefined();
      },
      { timeout: 5000 },
    );
  });

  it("renders a tag with the localised 'Cash' built-in label", async () => {
    setupMocks([
      makeInvoice({ id: "inv-cash", payment_method_label: "Cash" }),
    ]);
    render(<InvoicesPage />);

    // localizeMethodLabel routes "Cash" → tBuiltins("cash"), which under the
    // mock translator returns "paymentMethods.builtins.cash".
    await waitFor(
      () => {
        expect(screen.getByText("paymentMethods.builtins.cash")).toBeDefined();
      },
      { timeout: 5000 },
    );
  });

  it("renders a user-defined custom label verbatim", async () => {
    setupMocks([
      makeInvoice({
        id: "inv-custom",
        payment_method_label: "Wire transfer",
      }),
    ]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        expect(screen.getByText("Wire transfer")).toBeDefined();
      },
      { timeout: 5000 },
    );
  });

  it.each([
    ["null", null],
    ["empty string", ""],
    ["whitespace only", "   "],
  ])("renders an em-dash when payment_method_label is %s", async (_name, value) => {
    setupMocks([makeInvoice({ payment_method_label: value })]);
    render(<InvoicesPage />);

    await waitFor(
      () => {
        // The data row is rendered as <tr role="button">, so scope by that
        // role rather than "row" — the explicit role overrides the implicit
        // <tr> row role. Keeps us from matching em-dashes elsewhere on the page.
        const dashes = screen
          .getAllByRole("button")
          .flatMap((row) => within(row).queryAllByText("—"));
        expect(dashes.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );
  });
});
