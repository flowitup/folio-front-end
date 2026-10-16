/**
 * Refundable expenses with several administered companies: each row names the
 * company that owes the refund, and the page can be narrowed to one company
 * (company_id is sent to the API, the add dialog follows it).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  fetchRefundableExpenses: vi.fn(),
  fetchRefundableCandidates: vi.fn(),
  setRefundableStatus: vi.fn(),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const dialogProps = vi.fn();
vi.mock("@/components/billing/add-refundable-expense-dialog", () => ({
  AddRefundableExpenseDialog: (props: { companyId?: string }) => {
    dialogProps(props);
    return null;
  },
}));
vi.mock("@/components/billing/refundable-expense-attachments-cell", () => ({
  RefundableExpenseAttachmentsCell: () => null,
}));
vi.mock("@/components/billing/refundable-expense-row-actions", () => ({
  RefundableExpenseRowActions: () => null,
}));
vi.mock("@/components/billing/refundable-summary-cards", () => ({
  RefundableSummaryCards: () => null,
}));
// A native select stands in for Radix.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select data-testid="company-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));
const auth = vi.hoisted(() => ({ companies: [] as unknown[] }));
vi.mock("@/context/AuthContext", () => ({
  useOptionalAuth: () => ({ user: { companies: auth.companies } }),
}));

import { fetchRefundableExpenses } from "@/lib/api/billing/refundable-invoices";
import RefundableInvoicesPage from "@/app/[locale]/(app)/billing/refundable-invoices/page";

const row = (id: string, companyId: string, companyName: string) => ({
  id,
  invoice_number: `N-${id}`,
  recipient_name: "Supplier",
  issue_date: "2026-01-02",
  total_amount: 10,
  project_id: "p",
  project_name: "Site",
  company_id: companyId,
  company_name: companyName,
  refundable_status: "pending",
  attachments: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchRefundableExpenses).mockResolvedValue({
    items: [row("1", "co-a", "Alpha"), row("2", "co-b", "Beta")],
    total: 2,
    summary: null,
  } as never);
});

describe("Refundable expenses — company filter", () => {
  it("names each row's company and filters by company", async () => {
    auth.companies = [
      { id: "co-a", legal_name: "Alpha", role: "admin", is_primary: true },
      { id: "co-b", legal_name: "Beta", role: "admin", is_primary: false },
    ];
    render(<RefundableInvoicesPage />);
    await waitFor(() => expect(screen.getAllByTestId("refundable-row-company")).toHaveLength(2));
    expect(screen.getAllByTestId("refundable-row-company").map((c) => c.textContent)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(fetchRefundableExpenses).toHaveBeenCalledWith({ companyId: undefined });

    fireEvent.change(screen.getByTestId("company-select"), { target: { value: "co-b" } });
    await waitFor(() =>
      expect(fetchRefundableExpenses).toHaveBeenLastCalledWith({ companyId: "co-b" }),
    );
    expect(dialogProps).toHaveBeenLastCalledWith(expect.objectContaining({ companyId: "co-b" }));
  });

  it("keeps the single-company page as it was", async () => {
    auth.companies = [{ id: "co-a", legal_name: "Alpha", role: "admin", is_primary: true }];
    render(<RefundableInvoicesPage />);
    await waitFor(() => expect(fetchRefundableExpenses).toHaveBeenCalled());
    expect(screen.queryByTestId("refundable-company-filter")).toBeNull();
    expect(screen.queryByTestId("refundable-row-company")).toBeNull();
  });
});
