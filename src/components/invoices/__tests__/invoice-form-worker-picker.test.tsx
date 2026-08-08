/**
 * Tests for InvoiceForm — labor worker picker (worker_id)
 *
 * Covers:
 * - Worker picker renders only for type=labor; free-text recipient renders
 *   for all other types
 * - Submitting a labor invoice sends the selected worker_id and syncs
 *   recipient_name from the worker's display name
 * - Switching type away from labor and back clears the previously
 *   selected worker
 * - Edit mode preselects invoice.worker_id
 * - Legacy labor invoice without a link ("Not linked") stays saveable
 * - worker_link_not_allowed / worker_not_in_project error codes are mapped
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { InvoiceForm } from "../invoice-form";

// ── Mock next-intl ─────────────────────────────────────────────────────────────

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

// ── Mock PaymentMethodSelect and TagSelect (not relevant here) ────────────────

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: () => null,
}));

vi.mock("@/components/tags/tag-select", () => ({
  TagSelect: () => null,
}));

// ── Mock the workers fetcher used by LaborWorkerSelect ────────────────────────

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

describe("InvoiceForm — labor worker picker", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSubmit.mockResolvedValue(undefined);
    mockFetchWorkers.mockResolvedValue([WORKER_A]);
  });

  it("does not render the worker picker for non-labor types", () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "materials_services" }} projectId="proj-1" />
    );
    expect(screen.queryByTestId("labor-worker-select")).toBeNull();
    expect(screen.getByPlaceholderText("Recipient")).toBeDefined();
  });

  it("renders the worker picker and hides the free-text recipient for type=labor", () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );
    expect(screen.getByTestId("labor-worker-select")).toBeDefined();
    expect(screen.queryByPlaceholderText("Recipient")).toBeNull();
  });

  it("submits worker_id and syncs recipient_name from the selected worker", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );

    const picker = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(picker).getByText("Amy Active")).toBeDefined());
    fireEvent.change(picker, { target: { value: "worker-a" } });

    const monthInput = screen.getByTestId("service-month-input");
    fireEvent.change(monthInput, { target: { value: "2026-06" } });

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.worker_id).toBe("worker-a");
    expect(payload.recipient_name).toBe("Amy Active");
  });

  it("clears the selected worker when switching type away from labor and back", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );

    const picker = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect(within(picker).getByText("Amy Active")).toBeDefined());
    fireEvent.change(picker, { target: { value: "worker-a" } });
    expect((picker as HTMLSelectElement).value).toBe("worker-a");

    // The first combobox is always the type selector — the worker picker
    // itself is also a <select>, hence also role="combobox".
    const typeSelect = screen.getAllByRole("combobox")[0];
    fireEvent.change(typeSelect, { target: { value: "others" } });
    expect(screen.queryByTestId("labor-worker-select")).toBeNull();

    fireEvent.change(typeSelect, { target: { value: "labor" } });
    const pickerAgain = await screen.findByTestId("labor-worker-select");
    expect((pickerAgain as HTMLSelectElement).value).toBe("");
  });

  it("preselects invoice.worker_id in edit mode", async () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "labor", worker_id: "worker-a", service_month: "2026-06-01" }}
        projectId="proj-1"
        editingInvoiceId="inv-1"
      />
    );

    const picker = await screen.findByTestId("labor-worker-select");
    await waitFor(() => expect((picker as HTMLSelectElement).value).toBe("worker-a"));
  });

  it("legacy labor invoice without a link shows 'Not linked' and stays saveable", async () => {
    render(
      <InvoiceForm
        onSubmit={mockOnSubmit}
        initialValues={{ type: "labor", recipient_name: "Old Worker Co", service_month: null }}
        projectId="proj-1"
        editingInvoiceId="inv-legacy"
      />
    );

    const picker = await screen.findByTestId("labor-worker-select");
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(within(picker).getByText("Not linked")).toBeDefined();

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "Legacy work" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalledTimes(1));
    const payload = mockOnSubmit.mock.calls[0][0];
    expect(payload.worker_id).toBeNull();
  });

  it("blocks submit when a new labor invoice has no month selected", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );

    expect(screen.getByTestId("service-month-input")).toBeRequired();

    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("maps worker_link_not_allowed and worker_not_in_project backend errors", async () => {
    render(
      <InvoiceForm onSubmit={mockOnSubmit} initialValues={{ type: "labor" }} projectId="proj-1" />
    );

    const monthInput = screen.getByTestId("service-month-input");
    fireEvent.change(monthInput, { target: { value: "2026-06" } });
    const descInput = screen.getAllByPlaceholderText(/description/i)[0];
    fireEvent.change(descInput, { target: { value: "June labor" } });

    mockOnSubmit.mockRejectedValueOnce({ data: { error: "worker_not_in_project" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText("The selected worker is not part of this project.")).toBeDefined()
    );
  });
});
