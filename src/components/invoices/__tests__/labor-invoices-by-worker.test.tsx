/**
 * Tests for LaborInvoicesByWorker — the worker-grouped accordion shared by
 * the Expenses page's `labor` tab and the `all` tab's labor type group.
 *
 * Covers: alphabetical group order with Unassigned last, per-worker
 * totals/count/last-payment figures, expand/collapse, month-grouped
 * history with "No month" last, detail-expand routing through
 * onToggleInvoice (the page's existing ?invoice=<id> mechanism), deep-link
 * auto-expand, and the quick-assign PUT payload on Unassigned rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { LaborInvoicesByWorker } from "../labor-invoices-by-worker";
import type { Invoice } from "@/types/invoice";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const full = ns ? `${ns}.${key}` : key;
    return params ? `${full}(${JSON.stringify(params)})` : full;
  },
  useLocale: () => "en",
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => mockToastSuccess(...args), error: (...args: unknown[]) => mockToastError(...args) },
}));

vi.mock("@/lib/api/invoice-api", () => ({
  updateInvoice: vi.fn(),
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkers: vi.fn(),
}));

vi.mock("@/components/invoices/invoice-detail-row", () => ({
  InvoiceDetailRow: ({ invoiceId }: { invoiceId: string }) => (
    <div data-testid={`mock-detail-${invoiceId}`} />
  ),
}));

import { updateInvoice } from "@/lib/api/invoice-api";
import { fetchWorkers } from "@/lib/api/labor";

const mockUpdateInvoice = vi.mocked(updateInvoice);
const mockFetchWorkers = vi.mocked(fetchWorkers);

const WORKERS: Worker[] = [
  { id: "w-alice", project_id: "p1", name: "Alice", phone: null, daily_rate: 100, is_active: true, created_at: "" },
  { id: "w-bruno", project_id: "p1", name: "Bruno", phone: null, daily_rate: 120, is_active: true, created_at: "" },
];

function makeInvoice(overrides: Partial<Invoice>): Invoice {
  return {
    id: "inv-1",
    project_id: "p1",
    invoice_number: "FR-2026-0001",
    type: "labor",
    issue_date: "2026-06-01",
    recipient_name: "Alice",
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

function baseProps(overrides: Partial<React.ComponentProps<typeof LaborInvoicesByWorker>> = {}) {
  return {
    invoices: [] as Invoice[],
    projectId: "p1",
    variant: "desktop" as const,
    canManage: true,
    companyName: null,
    selectedInvoiceId: null,
    onToggleInvoice: vi.fn(),
    onCloseInvoice: vi.fn(),
    onMutated: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchWorkers.mockResolvedValue(WORKERS);
  mockUpdateInvoice.mockResolvedValue({} as Invoice);
});

describe("LaborInvoicesByWorker — group order and figures", () => {
  it("sorts groups alphabetically with Unassigned last and shows count/total/last-payment", async () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-bruno", recipient_name: "Bruno", total_amount: 100, service_month: "2026-05-01" }),
      makeInvoice({ id: "i2", worker_id: "w-alice", recipient_name: "Alice", total_amount: 200, service_month: "2026-06-01" }),
      makeInvoice({ id: "i3", worker_id: "w-alice", recipient_name: "Alice", total_amount: 50, service_month: "2026-04-01" }),
      makeInvoice({ id: "i4", worker_id: null, recipient_name: "Loose Co", total_amount: 30 }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);

    const container = screen.getByTestId("labor-by-worker-desktop");
    const groupRows = within(container).getAllByRole("button", { name: /Alice|Bruno|labor\.payments\.unassignedTitle/ });
    expect(groupRows.map((el) => el.textContent)).toEqual([
      expect.stringContaining("Alice"),
      expect.stringContaining("Bruno"),
      expect.stringContaining("labor.payments.unassignedTitle"),
    ]);

    // Alice group: 2 invoices, total 250, last payment = max service_month (2026-06)
    expect(screen.getByTestId("labor-by-worker-count-desktop-w-alice").textContent).toContain('"n":2');
    expect(screen.getByTestId("labor-by-worker-total-desktop-w-alice").textContent).toMatch(/250/);
    expect(screen.getByTestId("labor-by-worker-last-payment-desktop-w-alice").textContent).toBe("June 2026");
  });
});

describe("LaborInvoicesByWorker — expand/collapse and month history", () => {
  it("expands a group on click and shows month headers most-recent-first with No month last", async () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-alice", service_month: "2026-03-01" }),
      makeInvoice({ id: "i2", worker_id: "w-alice", service_month: "2026-06-01" }),
      makeInvoice({ id: "i3", worker_id: "w-alice", service_month: null }),
      // Second group so nothing auto-expands — this test exercises the manual click.
      makeInvoice({ id: "x9", worker_id: null, service_month: "2026-06-01" }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);

    fireEvent.click(screen.getByTestId("labor-by-worker-group-desktop-w-alice").querySelector("button")!);

    const history = await screen.findByTestId("labor-by-worker-history-desktop");
    const monthNodes = within(history).getAllByText(/June 2026|March 2026|invoices\.byWorker\.noMonthGroup/);
    expect(monthNodes.map((n) => n.textContent)).toEqual(["June 2026", "March 2026", "invoices.byWorker.noMonthGroup"]);
  });

  it("clicking an invoice row calls onToggleInvoice with the invoice id", async () => {
    const onToggleInvoice = vi.fn();
    const invoices = [makeInvoice({ id: "inv-42", worker_id: "w-alice", service_month: "2026-06-01" })];
    render(<LaborInvoicesByWorker {...baseProps({ invoices, onToggleInvoice })} />);

    // Sole group auto-expands; the invoice row is reachable without a group click.
    const row = await screen.findByTestId("labor-by-worker-invoice-desktop-inv-42");
    fireEvent.click(row);

    expect(onToggleInvoice).toHaveBeenCalledWith("inv-42");
  });

  it("renders the inline detail when selectedInvoiceId matches an expanded row", async () => {
    const invoices = [makeInvoice({ id: "inv-42", worker_id: "w-alice", service_month: "2026-06-01" })];
    render(<LaborInvoicesByWorker {...baseProps({ invoices, selectedInvoiceId: "inv-42" })} />);

    // Deep-link auto-expand: the owning group opens without a manual click.
    expect(await screen.findByTestId("mock-detail-inv-42")).toBeInTheDocument();
  });
});

describe("LaborInvoicesByWorker — quick-assign on Unassigned rows", () => {
  it("PUTs worker_id via updateInvoice, toasts success, and calls onMutated", async () => {
    const onMutated = vi.fn();
    const invoices = [makeInvoice({ id: "inv-9", worker_id: null })];
    render(<LaborInvoicesByWorker {...baseProps({ invoices, onMutated })} />);

    // Sole (Unassigned) group auto-expands on mount.
    await waitFor(() => expect(mockFetchWorkers).toHaveBeenCalledWith("p1"));

    const trigger = await screen.findByTestId("assign-worker-select");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: "Bruno" }));

    await waitFor(() => expect(mockUpdateInvoice).toHaveBeenCalledWith("p1", "inv-9", { worker_id: "w-bruno" }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    expect(onMutated).toHaveBeenCalled();
  });

  it("does not fetch workers or show the assign control when canManage is false", async () => {
    const invoices = [makeInvoice({ id: "inv-9", worker_id: null })];
    render(<LaborInvoicesByWorker {...baseProps({ invoices, canManage: false })} />);

    // Sole (Unassigned) group auto-expands on mount.
    await screen.findByTestId("labor-by-worker-invoice-desktop-inv-9");

    expect(mockFetchWorkers).not.toHaveBeenCalled();
    expect(screen.queryByTestId("assign-worker-select")).not.toBeInTheDocument();
  });
});

describe("LaborInvoicesByWorker — empty input", () => {
  it("renders nothing when invoices is empty", () => {
    const { container } = render(<LaborInvoicesByWorker {...baseProps({ invoices: [] })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("LaborInvoicesByWorker — recipient identity on history rows", () => {
  it("shows each invoice's recipient_name in the expanded history (legacy unassigned rows are otherwise anonymous)", async () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-alice", recipient_name: "Alice", service_month: "2026-06-01" }),
      makeInvoice({ id: "i4", worker_id: null, recipient_name: "Djamel B.", total_amount: 30 }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);

    const unassignedRow = screen.getByRole("button", { name: /labor\.payments\.unassignedTitle/ });
    fireEvent.click(unassignedRow);

    expect(screen.getByTestId("labor-by-worker-invoice-recipient-desktop-i4").textContent).toBe("Djamel B.");
  });

  it("falls back to an em dash when recipient_name is empty", async () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-alice", recipient_name: "Alice", service_month: "2026-06-01" }),
      makeInvoice({ id: "i9", worker_id: null, recipient_name: "" }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);
    fireEvent.click(screen.getByRole("button", { name: /labor\.payments\.unassignedTitle/ }));
    expect(screen.getByTestId("labor-by-worker-invoice-recipient-desktop-i9").textContent).toBe("—");
  });
});

describe("LaborInvoicesByWorker — single-group auto-expand", () => {
  it("auto-expands when the only group is Unassigned (legacy project: nothing hidden behind one row)", async () => {
    const invoices = [
      makeInvoice({ id: "i4", worker_id: null, recipient_name: "Djamel B." }),
      makeInvoice({ id: "i5", worker_id: null, recipient_name: "Karim", service_month: "2026-07-01" }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);

    // History visible without any click.
    expect(await screen.findByTestId("labor-by-worker-history-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("labor-by-worker-invoice-recipient-desktop-i4").textContent).toBe("Djamel B.");
  });

  it("does not auto-expand when several groups exist", () => {
    const invoices = [
      makeInvoice({ id: "i1", worker_id: "w-alice", recipient_name: "Alice", service_month: "2026-06-01" }),
      makeInvoice({ id: "i4", worker_id: null, recipient_name: "Loose Co" }),
    ];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);
    expect(screen.queryByTestId("labor-by-worker-history-desktop")).toBeNull();
  });

  it("keeps a user's collapse of the auto-expanded group (no re-expand fight)", async () => {
    const invoices = [makeInvoice({ id: "i4", worker_id: null, recipient_name: "Djamel B." })];
    render(<LaborInvoicesByWorker {...baseProps({ invoices })} />);
    expect(await screen.findByTestId("labor-by-worker-history-desktop")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /labor\.payments\.unassignedTitle/ }));
    expect(screen.queryByTestId("labor-by-worker-history-desktop")).toBeNull();
  });
});
