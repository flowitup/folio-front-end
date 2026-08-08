/**
 * Tests for InvoiceForm — free-text recipient fallback on create-mode,
 * unlinked labor invoices (review fix H1)
 *
 * Before this fix, a NEW labor invoice left on the worker picker's
 * "Not linked" option always submitted recipient_name: "" — the backend
 * schema requires min_length=1, so the create silently 422'd. This suite
 * proves the fix's exact shape:
 * - The free-text recipient shows (required) only for create-mode + labor +
 *   unlinked; a worker record has no name to snapshot from in that case.
 * - Submit is blocked until the recipient is filled.
 * - The submitted payload carries the typed recipient_name and worker_id
 *   null (not omitted — the backend clears any stale link on update).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      type: "Type",
      "types.released_funds": "Released Funds",
      "types.labor": "Labor",
      "types.materials_services": "Materials & Services",
      "types.others": "Others",
      "types.return": "Return",
      issueDate: "Issue date",
      recipient: "Recipient",
      workerPicker: "Worker",
      workerNotLinked: "Not linked",
      recipientAddress: "Address",
      notes: "Notes",
      items: "items",
      addItem: "Add item",
      description: "Description",
      quantity: "Qty",
      unitPrice: "Unit price",
      vatRate: "TVA %",
      total: "Total",
      totalAmount: "totalAmount",
      save: "Save",
      saving: "Saving...",
      serviceMonth: "Payment for month",
      errorRecipientRequired: "Recipient name is required",
      errorAtLeastOneItem: "At least one item is required",
      errorDescriptionRequired: "Description is required",
      errorQuantityPositive: "Quantity must be greater than 0",
      serviceMonthRequired: "Payment for month is required for labor expenses.",
      errorServiceMonthNotAllowed: "Payment for month can only be set on labor expenses.",
      errorWorkerLinkNotAllowed: "A worker can only be linked on labor expenses.",
      errorWorkerNotInProject: "The selected worker is not part of this project.",
      "select.label": "Select tag",
      errorRefundExceedsSource: values
        ? `Refund exceeds remaining (${values.remaining})`
        : "Refund exceeds remaining ({remaining})",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => null,
}));

vi.mock("@/components/tags/tag-select", () => ({
  TagSelect: () => null,
}));

vi.mock("@/lib/api/labor", () => ({
  fetchWorkers: vi.fn(),
}));

import { fetchWorkers } from "@/lib/api/labor";
const mockFetchWorkers = vi.mocked(fetchWorkers);

const WORKER_A = {
  id: "worker-a",
  project_id: "proj-1",
  name: "Legacy Name A",
  person_name: "Amy Active",
  phone: null,
  daily_rate: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

function fillMonthAndDescription() {
  fireEvent.change(screen.getByTestId("service-month-input"), {
    target: { value: "2026-06" },
  });
  fireEvent.change(screen.getAllByPlaceholderText(/description/i)[0], {
    target: { value: "June labor" },
  });
}

describe("InvoiceForm — unlinked labor recipient fallback (create mode)", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
    mockFetchWorkers.mockResolvedValue([WORKER_A]);
  });

  it("shows the free-text recipient by default (worker picker starts on 'Not linked')", () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    const input = screen.getByTestId("unlinked-labor-recipient-input");
    expect(input).toBeDefined();
    expect(input).toBeRequired();
  });

  it("blocks submit while the recipient is empty and unlinked (native required)", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    fillMonthAndDescription();

    expect(screen.getByTestId("unlinked-labor-recipient-input")).toBeRequired();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit for a whitespace-only recipient (JS-level validate)", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    fillMonthAndDescription();
    // Non-empty so it clears the browser's native required check, but
    // validate() still trims it to "" — the dedicated JS-level gate.
    fireEvent.change(screen.getByTestId("unlinked-labor-recipient-input"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Recipient name is required")).toBeDefined();
  });

  it("submits once the recipient is filled — payload carries the typed name and worker_id null", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    fillMonthAndDescription();
    fireEvent.change(screen.getByTestId("unlinked-labor-recipient-input"), {
      target: { value: "  Cash Day Laborer  " },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.recipient_name).toBe("Cash Day Laborer");
    expect(payload.worker_id).toBeNull();
  });

  it("hides the free-text recipient and stops requiring it once a worker is picked", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    fillMonthAndDescription();

    const picker = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(picker).getByText("Amy Active")).toBeDefined());
    fireEvent.change(picker, { target: { value: "worker-a" } });

    expect(screen.queryByTestId("unlinked-labor-recipient-input")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.worker_id).toBe("worker-a");
    expect(payload.recipient_name).toBe("Amy Active");
  });

  it("re-shows the required recipient input after picking then clearing back to 'Not linked'", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );

    const picker = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(picker).getByText("Amy Active")).toBeDefined());
    fireEvent.change(picker, { target: { value: "worker-a" } });
    expect(screen.queryByTestId("unlinked-labor-recipient-input")).toBeNull();

    fireEvent.change(picker, { target: { value: "" } });
    expect(screen.getByTestId("unlinked-labor-recipient-input")).toBeDefined();
  });
});
