/**
 * Tests for UnassignedLaborInvoices — the shared "cleanup queue" section
 * used for both the viewed month's unassigned bucket and the month-
 * independent "no month" bucket.
 *
 * Covers: quick-assign worker selection fires onAssignWorker(invoiceId,
 * workerId); the "assign to this month" button (no-month rows only) fires
 * onAssignMonth(invoiceId) without requiring a worker pick; empty state;
 * read-only mode hides both controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnassignedLaborInvoices } from "../unassigned-labor-invoices";
import type { Invoice } from "@/types/invoice";
import type { Worker } from "@/types/labor";

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

const WORKERS: Worker[] = [
  { id: "w1", project_id: "p1", name: "Alice", phone: null, daily_rate: 100, is_active: true, created_at: "" },
  { id: "w2", project_id: "p1", name: "Bruno", phone: null, daily_rate: 120, is_active: true, created_at: "" },
];

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    project_id: "p1",
    invoice_number: "FR-2026-0001",
    type: "labor",
    issue_date: "2026-07-10",
    recipient_name: "Unassigned",
    recipient_address: null,
    notes: null,
    items: [],
    total_amount: 300,
    created_by: "user-1",
    created_at: "",
    updated_at: "",
    payment_method_id: null,
    payment_method_label: null,
    source_billing_document_id: null,
    is_auto_generated: false,
    service_month: "2026-07-01",
    worker_id: null,
    ...overrides,
  };
}

describe("UnassignedLaborInvoices — empty state", () => {
  it("renders the empty message when there are no invoices", () => {
    render(
      <UnassignedLaborInvoices
        testId="section"
        title="Unassigned"
        invoices={[]}
        workers={WORKERS}
        canManage
        emptyMessage="Nothing to assign"
        onAssignWorker={vi.fn()}
      />,
    );
    expect(screen.getByText("Nothing to assign")).toBeInTheDocument();
  });
});

describe("UnassignedLaborInvoices — quick-assign worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls onAssignWorker with the invoice id and the picked worker id", () => {
    const onAssignWorker = vi.fn();
    render(
      <UnassignedLaborInvoices
        testId="section"
        title="Unassigned"
        invoices={[makeInvoice({ id: "inv-42" })]}
        workers={WORKERS}
        canManage
        emptyMessage="Nothing to assign"
        onAssignWorker={onAssignWorker}
      />,
    );

    const trigger = screen.getByTestId("assign-worker-select");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Bruno" }));

    expect(onAssignWorker).toHaveBeenCalledWith("inv-42", "w2");
  });

  it("does not render the assign control when canManage is false", () => {
    render(
      <UnassignedLaborInvoices
        testId="section"
        title="Unassigned"
        invoices={[makeInvoice()]}
        workers={WORKERS}
        canManage={false}
        emptyMessage="Nothing to assign"
        onAssignWorker={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("assign-worker-select")).not.toBeInTheDocument();
  });
});

describe("UnassignedLaborInvoices — no-month 'assign to this month' action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fires onAssignMonth(invoiceId) on click, independent of worker selection", () => {
    const onAssignMonth = vi.fn();
    const onAssignWorker = vi.fn();
    render(
      <UnassignedLaborInvoices
        testId="no-month"
        title="No month set"
        invoices={[makeInvoice({ id: "inv-7", service_month: null, worker_id: "w1" })]}
        workers={WORKERS}
        canManage
        emptyMessage="Nothing here"
        assignMonthLabel="Assign to July 2026"
        onAssignWorker={onAssignWorker}
        onAssignMonth={onAssignMonth}
      />,
    );

    fireEvent.click(screen.getByText("Assign to July 2026"));

    expect(onAssignMonth).toHaveBeenCalledWith("inv-7");
    expect(onAssignWorker).not.toHaveBeenCalled();
  });

  it("omits the assign-to-month button when assignMonthLabel/onAssignMonth are absent", () => {
    render(
      <UnassignedLaborInvoices
        testId="section"
        title="Unassigned"
        invoices={[makeInvoice()]}
        workers={WORKERS}
        canManage
        emptyMessage="Nothing here"
        onAssignWorker={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
