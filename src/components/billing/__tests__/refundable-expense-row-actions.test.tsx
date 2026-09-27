import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { RefundableExpense } from "@/types/invoice";

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  setRefundableStatus: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Plain menu: every item is a button that fires its onSelect.
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}));

import { toast } from "sonner";
import { setRefundableStatus } from "@/lib/api/billing/refundable-invoices";
import { RefundableExpenseRowActions } from "../refundable-expense-row-actions";

const EXPENSE = {
  id: "exp-1",
  project_id: "p-1",
  project_name: "House",
  invoice_number: "INV-2026-0005",
  recipient_name: "Leroy Merlin",
  issue_date: "2026-09-01",
  total_amount: 120,
  refundable_status: "refunded",
  refunded_by: "bank",
  has_bank_refund: true,
  funds_release_number: "FR-2026-0001",
  attachments: [],
} as RefundableExpense;

function renderActions(onReload = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <RefundableExpenseRowActions expense={EXPENSE} onReload={onReload} />
    </NextIntlClientProvider>
  );
  return onReload;
}

beforeEach(() => vi.clearAllMocks());

describe("RefundableExpenseRowActions — Remove", () => {
  it("asks for confirmation, naming the funds release that goes with it", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(setRefundableStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("FR-2026-0001");
  });

  it("clears the status once confirmed and says so", async () => {
    const onReload = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = screen.getAllByRole("button", { name: "Remove" }).at(-1)!;
    fireEvent.click(confirm);

    await waitFor(() => expect(setRefundableStatus).toHaveBeenCalledWith("exp-1", null, undefined));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(enMessages.billing.refundable.removed);
  });
});
