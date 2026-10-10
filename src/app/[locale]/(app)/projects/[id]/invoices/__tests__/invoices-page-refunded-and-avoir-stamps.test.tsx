/**
 * Tests for InvoicesPage, read with the real en/fr messages:
 * - a refunded expense shows a lock (with the reason) instead of a delete that
 *   the API always refuses
 * - a refused delete shows the translated reason, not the API's English text
 * - an applied avoir reads "Avoir" once in French (type and settlement badge
 *   are the same word there), and keeps its badge in English
 *
 * Dual-render note: jsdom renders both the mobile cards (real component here)
 * and the desktop table; desktop assertions are scoped to its test id.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import type { Invoice } from "@/types/invoice";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

const messages = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace?: string) =>
    (key: string, params?: Record<string, unknown>) => {
      const path = (namespace ? `${namespace}.${key}` : key).split(".");
      let value: unknown = messages.current;
      for (const part of path) value = (value as Record<string, unknown> | undefined)?.[part];
      let text = typeof value === "string" ? value : path.join(".");
      for (const [k, v] of Object.entries(params ?? {})) text = text.replace(`{${k}}`, String(v));
      return text;
    },
  useLocale: () => "fr",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "proj-1", locale: "fr" }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/fr/projects/proj-1/invoices",
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:manage_invoices"] } }),
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
  InvoiceDetailRow: () => null,
}));

vi.mock("@/components/invoices/invoice-highlight-picker", () => ({
  InvoiceHighlightPicker: () => <span data-testid="highlight-picker" />,
}));

import { fetchInvoicesWithMeta, deleteInvoice } from "@/lib/api/invoice-api";
import InvoicesPage from "../page";

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "proj-1",
    invoice_number: "INV-2026-0001",
    type: "materials_services",
    issue_date: "2026-05-01",
    recipient_name: "Supplier",
    recipient_address: null,
    notes: null,
    items: [{ description: "Line", quantity: 1, unit_price: 100, total: 100 }],
    total_amount: 100,
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

function setInvoices(invoices: Invoice[]) {
  vi.mocked(fetchInvoicesWithMeta).mockResolvedValue({
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

const appliedAvoir = makeInvoice({
  id: "ret-1",
  invoice_number: "INV-2026-0014",
  type: "return",
  items: [{ description: "Credit", quantity: 1, unit_price: -20, total: -20 }],
  total_amount: -20,
  settled_via: "avoir",
  applied_to_invoice_id: "inv-13",
  applied_to_invoice_number: "INV-2026-0013",
});

async function desktopTable() {
  render(<InvoicesPage />);
  return within(await screen.findByTestId("invoices-table-desktop"));
}

describe("InvoicesPage — refunded expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messages.current = fr;
  });

  it("shows the lock and its reason instead of a delete button on a refunded row", async () => {
    setInvoices([
      makeInvoice({ id: "a", invoice_number: "INV-2026-0002", refundable_status: "refunded" }),
      makeInvoice({ id: "b", invoice_number: "INV-2026-0003" }),
    ]);
    const desktop = await desktopTable();

    const lock = desktop.getByTestId("refunded-locked-desktop");
    expect(lock.getAttribute("aria-label")).toBe(fr.invoices.errorRefundedLocked);
    expect(lock.getAttribute("title")).toBe(fr.invoices.errorRefundedLocked);
    expect(desktop.queryByLabelText(fr.invoices.deleteExpense.replace("{number}", "INV-2026-0002"))).toBeNull();
    // The cosmetic highlight stays on both rows; the other row keeps its delete.
    expect(desktop.getAllByTestId("highlight-picker")).toHaveLength(2);
    expect(desktop.getByLabelText(fr.invoices.deleteExpense.replace("{number}", "INV-2026-0003"))).toBeDefined();
  });

  it("shows a refused delete's reason in the UI language", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteInvoice).mockRejectedValue({
      status: 400,
      data: { error: "ValidationError", message: "Unlink or delete this invoice's returns first" },
    });
    setInvoices([makeInvoice({ invoice_number: "INV-2026-0009" })]);
    const desktop = await desktopTable();

    fireEvent.click(desktop.getByLabelText(fr.invoices.deleteExpense.replace("{number}", "INV-2026-0009")));

    expect(await screen.findByText(fr.invoices.errorUnlinkReturnsFirst)).toBeDefined();
    expect(screen.queryByText("Unlink or delete this invoice's returns first")).toBeNull();
  });
});

describe("InvoicesPage — avoir stamps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads 'Avoir' once in French: the group stamp, no repeat on the row", async () => {
    messages.current = fr;
    setInvoices([appliedAvoir]);
    const desktop = await desktopTable();

    await waitFor(() => expect(desktop.getByTestId("applied-to-label-desktop")).toBeDefined());
    expect(desktop.getAllByText(fr.invoices.types.return)).toHaveLength(1);
    expect(desktop.queryByTestId("avoir-badge-desktop")).toBeNull();
    // Mobile card: one type stamp, no identical badge after it.
    expect(screen.queryByTestId("avoir-badge")).toBeNull();
  });

  it("keeps the distinct 'Avoir' badge in English, with the type only on the group stamp", async () => {
    messages.current = en;
    setInvoices([appliedAvoir]);
    const desktop = await desktopTable();

    await waitFor(() => expect(desktop.getByTestId("avoir-badge-desktop")).toBeDefined());
    expect(desktop.getAllByText(en.invoices.types.return)).toHaveLength(1);
    expect(screen.getByTestId("avoir-badge").textContent).toBe(en.invoices.settledVia.avoirBadge);
  });
});
