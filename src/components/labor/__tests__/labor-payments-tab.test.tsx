/**
 * Integration tests for LaborPaymentsTab — the Payments tab container.
 *
 * Covers: default-month selection drives the initial fetches, merged rows
 * reach LaborPaymentRow with the right owed/paid, the header "record
 * payment" button opens the dialog with no worker preselected, a row's
 * button preselects that worker, and the two quick-assign payload shapes
 * (this-month unassigned vs no-month) call updateInvoice correctly.
 *
 * Child components (LaborPaymentRow, UnassignedLaborInvoices,
 * RecordLaborPaymentDialog) are mocked to isolate the container's data
 * orchestration — each has its own dedicated unit test file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LaborPaymentsTab } from "../labor-payments-tab";
import type { Worker } from "@/types/labor";
import type { WorkerPaymentRow } from "../labor-payments-tab-state";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string, params?: Record<string, unknown>) => {
    const full = ns ? `${ns}.${key}` : key;
    if (!params) return full;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{${k}}`, String(v)), full);
  },
  useLocale: () => "en",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api/labor", () => ({
  fetchLaborSummary: vi.fn(),
  fetchLaborMonthlySummary: vi.fn(),
  fetchLaborPaymentsSummary: vi.fn(),
  formatEUR: (v: number) => `€${v}`,
}));

vi.mock("@/lib/api/invoice-api", () => ({
  fetchInvoicesWithMeta: vi.fn(),
  updateInvoice: vi.fn(),
}));

vi.mock("../labor-payment-row", () => ({
  LaborPaymentRow: ({
    row,
    variant,
    onRecordPayment,
  }: {
    row: WorkerPaymentRow;
    variant: string;
    onRecordPayment: () => void;
  }) =>
    variant === "desktop" ? (
      <tr data-testid={`row-${row.worker_id}`} data-owed={row.owed} data-paid={row.paid} data-status={row.status}>
        <td>
          <button type="button" onClick={onRecordPayment}>
            record-{row.worker_id}
          </button>
        </td>
      </tr>
    ) : null,
}));

vi.mock("../unassigned-labor-invoices", () => ({
  UnassignedLaborInvoices: ({
    testId,
    invoices,
    onAssignWorker,
    onAssignMonth,
  }: {
    testId: string;
    invoices: { id: string }[];
    onAssignWorker: (invoiceId: string, workerId: string) => void;
    onAssignMonth?: (invoiceId: string) => void;
  }) => (
    <div data-testid={testId}>
      {invoices.map((inv) => (
        <div key={inv.id}>
          <button type="button" onClick={() => onAssignWorker(inv.id, "w-mock")}>
            assign-worker-{inv.id}
          </button>
          {onAssignMonth && (
            <button type="button" onClick={() => onAssignMonth(inv.id)}>
              assign-month-{inv.id}
            </button>
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../record-labor-payment-dialog", () => ({
  RecordLaborPaymentDialog: ({
    open,
    worker,
    month,
  }: {
    open: boolean;
    worker: Worker | null;
    month: string;
  }) =>
    open ? (
      <div data-testid="record-dialog" data-worker-id={worker?.id ?? ""} data-month={month} />
    ) : null,
}));

import { fetchLaborSummary, fetchLaborMonthlySummary, fetchLaborPaymentsSummary } from "@/lib/api/labor";
import { fetchInvoicesWithMeta, updateInvoice } from "@/lib/api/invoice-api";

const mockFetchLaborSummary = vi.mocked(fetchLaborSummary);
const mockFetchLaborMonthlySummary = vi.mocked(fetchLaborMonthlySummary);
const mockFetchLaborPaymentsSummary = vi.mocked(fetchLaborPaymentsSummary);
const mockFetchInvoicesWithMeta = vi.mocked(fetchInvoicesWithMeta);
const mockUpdateInvoice = vi.mocked(updateInvoice);

const WORKERS: Worker[] = [
  { id: "w1", project_id: "p1", name: "Alice", person_name: "Alice", phone: null, daily_rate: 100, is_active: true, created_at: "" },
];

function makeInvoiceMeta(invoices: { id: string; worker_id: string | null; service_month: string | null }[]) {
  return {
    invoices,
    total: invoices.length,
    funds_released_total: 0,
    company_spent_total: 0,
    company_name: null,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchLaborMonthlySummary.mockResolvedValue({
    rows: [{ year: 2026, month: 7, total_days: 5, total_cost: 500, workers: [] }],
  });
  mockFetchLaborPaymentsSummary.mockResolvedValue({
    months: [
      {
        year: 2026,
        month: 7,
        total_paid: 300,
        workers: [{ worker_id: "w1", worker_name: "Alice", paid: 300, invoice_count: 1 }],
        unassigned_paid: 0,
        unassigned_count: 0,
      },
    ],
  });
  mockFetchLaborSummary.mockResolvedValue({
    rows: [{ worker_id: "w1", worker_name: "Alice", days_worked: 5, total_cost: 500, banked_hours: 0, bonus_full_days: 0, bonus_half_days: 0, bonus_cost: 0 }],
    total_days: 5,
    total_cost: 500,
    total_banked_hours: 0,
    total_bonus_days: 0,
    total_bonus_cost: 0,
  });
  // Differentiate the two call shapes: the month-scoped unassigned fetch
  // passes a serviceMonth (4th arg); the no-month fetch omits it.
  mockFetchInvoicesWithMeta.mockImplementation((async (...args: unknown[]) => {
    const serviceMonth = args[3];
    if (serviceMonth) {
      return makeInvoiceMeta([{ id: "inv-unassigned", worker_id: null, service_month: "2026-07-01" }]);
    }
    return makeInvoiceMeta([{ id: "inv-nomonth", worker_id: null, service_month: null }]);
  }) as typeof fetchInvoicesWithMeta);
  mockUpdateInvoice.mockResolvedValue({} as never);
});

describe("LaborPaymentsTab — default month + merged rows", () => {
  it("picks the default month from the monthly/payments data and renders the merged row", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);

    const row = await screen.findByTestId("row-w1");
    expect(row).toHaveAttribute("data-owed", "500");
    expect(row).toHaveAttribute("data-paid", "300");
    expect(row).toHaveAttribute("data-status", "partial");

    // Both month-scoped fetches ran against the resolved default month (2026-07).
    await waitFor(() => expect(mockFetchLaborSummary).toHaveBeenCalledWith("p1", { from: "2026-07-01", to: "2026-07-31" }));
  });
});

describe("LaborPaymentsTab — record payment dialog wiring", () => {
  it("header button opens the dialog with no worker preselected", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);
    await screen.findByTestId("row-w1");

    fireEvent.click(screen.getByText("labor.payments.recordPayment"));

    const dialog = await screen.findByTestId("record-dialog");
    expect(dialog).toHaveAttribute("data-worker-id", "");
    expect(dialog).toHaveAttribute("data-month", "2026-07");
  });

  it("a row's record button preselects that worker", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);
    await screen.findByTestId("row-w1");

    fireEvent.click(screen.getByText("record-w1"));

    const dialog = await screen.findByTestId("record-dialog");
    expect(dialog).toHaveAttribute("data-worker-id", "w1");
  });
});

describe("LaborPaymentsTab — quick-assign payloads", () => {
  it("assigning a worker in the this-month unassigned section PUTs worker_id only", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);

    // findByText (not findByTestId + getByText) so the assertion itself
    // waits out the async fetch that populates the section's invoices —
    // the mocked section renders its container div immediately, before
    // its `invoices` prop is populated, which is racy under parallel load.
    fireEvent.click(await screen.findByText("assign-worker-inv-unassigned"));

    await waitFor(() =>
      expect(mockUpdateInvoice).toHaveBeenCalledWith("p1", "inv-unassigned", { worker_id: "w-mock" }),
    );
  });

  it("assigning a worker in the no-month section PUTs worker_id AND the viewed service_month", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);

    fireEvent.click(await screen.findByText("assign-worker-inv-nomonth"));

    await waitFor(() =>
      expect(mockUpdateInvoice).toHaveBeenCalledWith("p1", "inv-nomonth", {
        worker_id: "w-mock",
        service_month: "2026-07-01",
      }),
    );
  });

  it("the no-month 'assign to this month' button PUTs service_month only", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);

    fireEvent.click(await screen.findByText("assign-month-inv-nomonth"));

    await waitFor(() =>
      expect(mockUpdateInvoice).toHaveBeenCalledWith("p1", "inv-nomonth", { service_month: "2026-07-01" }),
    );
  });
});

describe("LaborPaymentsTab — shared payments summary from a parent", () => {
  it("reuses a parent-supplied paymentsSummary instead of fetching its own", async () => {
    // labor/page.tsx lifts this fetch so the Summary tab's Paid column and
    // this tab share one call instead of each re-fetching on every tab
    // switch — passing both props should skip this component's own fetch.
    const sharedPaymentsSummary = {
      months: [
        {
          year: 2026,
          month: 7,
          total_paid: 300,
          workers: [{ worker_id: "w1", worker_name: "Alice", paid: 300, invoice_count: 1 }],
          unassigned_paid: 0,
          unassigned_count: 0,
        },
      ],
    };
    const onReloadPaymentsSummary = vi.fn().mockResolvedValue(sharedPaymentsSummary);

    render(
      <LaborPaymentsTab
        projectId="p1"
        canManage
        workers={WORKERS}
        paymentsSummary={sharedPaymentsSummary}
        onReloadPaymentsSummary={onReloadPaymentsSummary}
      />,
    );

    const row = await screen.findByTestId("row-w1");
    expect(row).toHaveAttribute("data-paid", "300");
    expect(mockFetchLaborPaymentsSummary).not.toHaveBeenCalled();
  });

  it("still fetches its own payments summary when used standalone (no shared props)", async () => {
    render(<LaborPaymentsTab projectId="p1" canManage workers={WORKERS} />);
    await screen.findByTestId("row-w1");
    expect(mockFetchLaborPaymentsSummary).toHaveBeenCalledWith("p1");
  });
});
