/**
 * Tests for TransferToCompanyPaymentAction — the button that marks a
 * materials & services invoice "refundable" (kicks off the company-payment
 * transfer workflow).
 *
 * Previously exercised only indirectly, via the row-level render on the
 * (now removed) flat expense table. The row no longer renders this button
 * directly — it's still reachable through the invoice detail (InvoiceDetailContent),
 * whose visibility gating is covered by invoice-detail-content-paid-by-company.test.tsx.
 * This file covers the button's own click behavior in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TransferToCompanyPaymentAction } from "../transfer-to-company-payment-action";
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";
import { ApiError } from "@/lib/api/http";
import { toast } from "sonner";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `invoices.${key}`,
}));

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockSetRefundableStatus = vi.mocked(setRefundableStatus);

describe("TransferToCompanyPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls setRefundableStatus('refundable') and onSuccess on click", async () => {
    mockSetRefundableStatus.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<TransferToCompanyPaymentAction invoiceId="inv-1" onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: "invoices.refund.action.transfer" }));

    await waitFor(() => {
      expect(mockSetRefundableStatus).toHaveBeenCalledWith("inv-1", "refundable");
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith("invoices.refund.transferSuccess");
    });
  });

  it("shows a forbidden toast on 403 and does not call onSuccess", async () => {
    mockSetRefundableStatus.mockRejectedValue(new ApiError("Forbidden", 403));
    const onSuccess = vi.fn();
    render(<TransferToCompanyPaymentAction invoiceId="inv-1" onSuccess={onSuccess} />);

    fireEvent.click(screen.getByRole("button", { name: "invoices.refund.action.transfer" }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("invoices.refund.transferForbidden");
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a generic error toast on a non-403 failure", async () => {
    mockSetRefundableStatus.mockRejectedValue(new Error("Server error"));
    render(<TransferToCompanyPaymentAction invoiceId="inv-1" onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "invoices.refund.action.transfer" }));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("invoices.refund.transferError");
    });
  });
});
