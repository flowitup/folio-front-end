/**
 * Tests for RecordLaborPaymentDialog — the slim create-invoice flow for a
 * single labor payment (type=labor fixed, single line item, amount-focused).
 *
 * Covers: worker-preselected (row trigger) vs worker-required (header
 * trigger) payload composition, amount validation, and the exact
 * createInvoice payload shape (service_month, worker_id, single item).
 *
 * Timer/interaction landmines from CLAUDE.md: fireEvent (not userEvent),
 * sonner mocked as a plain object (no `as unknown as {...}` cast needed
 * here since we only assert calls, not intercept dynamic ids).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecordLaborPaymentDialog } from "../record-labor-payment-dialog";
import type { Worker } from "@/types/labor";

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

vi.mock("@/lib/api/invoice-api", () => ({
  createInvoice: vi.fn(),
}));

vi.mock("@/components/invoices/labor-worker-select", () => ({
  LaborWorkerSelect: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (id: string | null, worker: Worker | null) => void;
  }) => (
    <select
      data-testid="labor-worker-select-mock"
      value={value ?? ""}
      onChange={(e) => {
        const id = e.target.value || null;
        onChange(id, id ? WORKER : null);
      }}
    >
      <option value="">Not linked</option>
      <option value="worker-9">Header Picked Worker</option>
    </select>
  ),
}));

vi.mock("@/components/invoices/payment-method-select", () => ({
  PaymentMethodSelect: ({
    companyId,
    value,
    onChange,
  }: {
    companyId: string;
    value: string | null;
    onChange: (id: string | null) => void;
  }) => (
    <select
      data-testid="payment-method-select-mock"
      data-company-id={companyId}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">None</option>
      <option value="pm-1">Cash</option>
    </select>
  ),
}));

import { createInvoice } from "@/lib/api/invoice-api";
import { toast } from "sonner";

const mockCreateInvoice = vi.mocked(createInvoice);

const WORKER: Worker = {
  id: "worker-9",
  project_id: "proj-1",
  name: "Header Picked Worker",
  phone: null,
  daily_rate: 100,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const PRESELECTED_WORKER: Worker = {
  id: "worker-1",
  project_id: "proj-1",
  name: "Jean Dupont",
  person_name: "Jean Dupont",
  phone: null,
  daily_rate: 150,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
};

const BASE_PROPS = {
  projectId: "proj-1",
  open: true,
  onOpenChange: vi.fn(),
  month: "2026-07",
  onSaved: vi.fn(),
};

describe("RecordLaborPaymentDialog — worker preselected (row trigger)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the worker's name in the title and hides the worker picker", () => {
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} />);
    expect(screen.getByText("labor.payments.recordPaymentFor")).toBeInTheDocument();
    expect(screen.queryByTestId("labor-worker-select-mock")).not.toBeInTheDocument();
  });

  it("posts the correct createInvoice payload on save", async () => {
    mockCreateInvoice.mockResolvedValue({ id: "inv-1" } as never);
    const onSaved = vi.fn();
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} onSaved={onSaved} />);

    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "1200" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(mockCreateInvoice).toHaveBeenCalledTimes(1));
    const [projectId, payload] = mockCreateInvoice.mock.calls[0];
    expect(projectId).toBe("proj-1");
    expect(payload).toMatchObject({
      type: "labor",
      recipient_name: "Jean Dupont",
      worker_id: "worker-1",
      service_month: "2026-07-01",
      payment_method_id: null,
      tag_id: null,
    });
    expect(payload.items).toEqual([
      { description: expect.stringContaining("Jean Dupont"), quantity: 1, unit_price: 1200, vat_rate: 0 },
    ]);
    expect(onSaved).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("labor.payments.recordedToast");
  });

  it("rejects a non-positive amount without calling createInvoice", async () => {
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} />);
    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(screen.getByText("labor.payments.errorAmountPositive")).toBeInTheDocument());
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });
});

describe("RecordLaborPaymentDialog — no worker preselected (header trigger)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the worker picker and requires a selection before saving", async () => {
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={null} />);
    expect(screen.getByTestId("labor-worker-select-mock")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(screen.getByText("labor.payments.errorWorkerRequired")).toBeInTheDocument());
    expect(mockCreateInvoice).not.toHaveBeenCalled();
  });

  it("posts worker_id chosen from the picker once selected", async () => {
    mockCreateInvoice.mockResolvedValue({ id: "inv-2" } as never);
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={null} />);

    fireEvent.change(screen.getByTestId("labor-worker-select-mock"), { target: { value: "worker-9" } });
    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "750" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(mockCreateInvoice).toHaveBeenCalledTimes(1));
    const [, payload] = mockCreateInvoice.mock.calls[0];
    expect(payload.worker_id).toBe("worker-9");
    expect(payload.recipient_name).toBe("Header Picked Worker");
  });
});

describe("RecordLaborPaymentDialog — optional payment method picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides the picker when the project has no company", () => {
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} />);
    expect(screen.queryByTestId("payment-method-select-mock")).not.toBeInTheDocument();
  });

  it("renders the picker scoped to the project's company", () => {
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} companyId="co-1" />);
    expect(screen.getByTestId("payment-method-select-mock")).toHaveAttribute("data-company-id", "co-1");
  });

  it("posts the chosen payment_method_id", async () => {
    mockCreateInvoice.mockResolvedValue({ id: "inv-1" } as never);
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} companyId="co-1" />);

    fireEvent.change(screen.getByTestId("payment-method-select-mock"), { target: { value: "pm-1" } });
    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(mockCreateInvoice).toHaveBeenCalledTimes(1));
    expect(mockCreateInvoice.mock.calls[0][1]).toMatchObject({ payment_method_id: "pm-1" });
  });

  it("still posts null when the picker is left untouched", async () => {
    mockCreateInvoice.mockResolvedValue({ id: "inv-1" } as never);
    render(<RecordLaborPaymentDialog {...BASE_PROPS} worker={PRESELECTED_WORKER} companyId="co-1" />);

    fireEvent.change(screen.getByTestId("record-payment-amount"), { target: { value: "500" } });
    fireEvent.click(screen.getByText("invoices.save"));

    await waitFor(() => expect(mockCreateInvoice).toHaveBeenCalledTimes(1));
    expect(mockCreateInvoice.mock.calls[0][1]).toMatchObject({ payment_method_id: null });
  });
});
