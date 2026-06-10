/**
 * Tests for the Refundable Invoices page and RefundableExpenseRowActions.
 *
 * Verifies:
 *   - Table rows render from mocked fetchRefundableExpenses with correct status labels
 *   - Changing status calls setRefundableStatus(id, <new>) then reloads
 *   - "Remove" calls setRefundableStatus(id, null) then reloads
 *   - Empty state renders when the list is empty
 *   - Error state renders when fetch fails
 *   - Truncation notice renders when total > items.length
 *   - Truncation notice is absent when total === items.length
 *
 * Mocking strategy:
 *   - @/lib/api/billing/refundable-invoices: vi.fn() stubs
 *   - next-intl: key-lookup against en.json
 *   - sonner: as-unknown-as cast pattern
 *   - add-refundable-expense-dialog: stubbed to avoid deep rendering
 *
 * Interaction: fireEvent — avoids fake-timer deadlocks with Radix.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks (before component imports)
// ---------------------------------------------------------------------------

vi.mock("@/lib/api/billing/refundable-invoices", () => ({
  fetchRefundableExpenses: vi.fn(),
  fetchRefundableCandidates: vi.fn(),
  setRefundableStatus: vi.fn(),
}));

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    let str = resolve(en, `${ns}.${key}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return str;
  };
  return {
    useLocale: () => "en",
    useTranslations: (ns: string) => makeT(ns),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  },
}));

// Stub the dialog to avoid deep rendering / fetch cascades
vi.mock("@/components/billing/add-refundable-expense-dialog", () => ({
  AddRefundableExpenseDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-dialog" /> : null,
}));

// Stub the attachments cell — blob fetching is tested in its own suite
vi.mock("@/components/billing/refundable-expense-attachments-cell", () => ({
  RefundableExpenseAttachmentsCell: ({ attachments }: { attachments: unknown[] }) => (
    <span data-testid="attachments-cell" data-count={attachments.length} />
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import RefundableInvoicesPage from "@/app/[locale]/(app)/billing/refundable-invoices/page";
import {
  fetchRefundableExpenses,
  setRefundableStatus,
} from "@/lib/api/billing/refundable-invoices";
import type { RefundableExpense } from "@/types/invoice";

const mockFetch = vi.mocked(fetchRefundableExpenses);
const mockSet = vi.mocked(setRefundableStatus);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<RefundableExpense> = {}): RefundableExpense {
  return {
    id: "exp-1",
    project_id: "proj-1",
    project_name: "Tower Block",
    invoice_number: "INV-2026-001",
    recipient_name: "Acme Supplies",
    issue_date: "2026-03-15",
    total_amount: 1500.0,
    refundable_status: "refundable",
    attachments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RefundableInvoicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  it("renders rows with project name and colored status label", async () => {
    const expense = makeExpense({ refundable_status: "refund_pending" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1 });

    render(<RefundableInvoicesPage />);

    // Status label (from en.json: billing.refundable.status.refundPending)
    await waitFor(() => {
      expect(screen.getByText("Tower Block")).toBeDefined();
    });
    expect(screen.getByText("Refund pending")).toBeDefined();
    expect(screen.getByText("INV-2026-001")).toBeDefined();
  });

  it("renders 'refundable' status stamp label", async () => {
    mockFetch.mockResolvedValue({ items: [makeExpense()], total: 1 });
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText("Refundable")).toBeDefined();
    });
  });

  it("renders 'refunded' status stamp label", async () => {
    mockFetch.mockResolvedValue({
      items: [makeExpense({ refundable_status: "refunded" })],
      total: 1,
    });
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText("Refunded")).toBeDefined();
    });
  });

  it("renders the invoice column header and attachment cell per row", async () => {
    const expense = makeExpense({
      attachments: [{ id: "a1", filename: "receipt.pdf", mime_type: "application/pdf", size_bytes: 1024 }],
    });
    mockFetch.mockResolvedValue({ items: [expense], total: 1 });

    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("Tower Block"));

    // Header column rendered
    expect(screen.getByText("Invoice")).toBeDefined();
    // Stubbed cell rendered with correct count
    const cell = screen.getByTestId("attachments-cell");
    expect(cell.getAttribute("data-count")).toBe("1");
  });

  it("shows empty state when list is empty", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0 });
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText("No refundable expenses yet.")).toBeDefined();
    });
  });

  it("shows error state when fetch rejects", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load expenses.")).toBeDefined();
    });
  });

  it("calls setRefundableStatus(id, null) when Remove is selected", async () => {
    const user = userEvent.setup();
    const expense = makeExpense();
    mockFetch.mockResolvedValue({ items: [expense], total: 1 });

    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("Tower Block"));

    // Open the dropdown via userEvent (Radix requires pointer events)
    const trigger = screen.getByRole("button", { name: /change status/i });
    await user.click(trigger);

    // Items render in a Radix portal — query document directly
    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const removeItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /remove/i.test(el.textContent ?? "")
    )!;
    await user.click(removeItem);

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", null);
    });
    // After remove the list reloads
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("calls setRefundableStatus(id, 'refunded') when Refunded is selected", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refund_pending" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1 });

    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("Tower Block"));

    const trigger = screen.getByRole("button", { name: /change status/i });
    await user.click(trigger);

    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const refundedItem = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded$/i.test(el.textContent?.trim() ?? "")
    )!;
    await user.click(refundedItem);

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", "refunded");
    });
  });

  it("opens the Add dialog when the Add button is clicked", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0 });
    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("No refundable expenses yet."));

    fireEvent.click(screen.getByText("Add refundable expense"));
    expect(screen.getByTestId("add-dialog")).toBeDefined();
  });

  it("shows truncation notice when total > items.length", async () => {
    const items = [makeExpense({ id: "exp-1" }), makeExpense({ id: "exp-2", invoice_number: "INV-002" })];
    mockFetch.mockResolvedValue({ items, total: 75 });

    render(<RefundableInvoicesPage />);
    // Two rows with "Tower Block" — wait for the unique invoice number instead
    await waitFor(() => screen.getByText("INV-002"));

    // en.json: "Showing {count} of {total}" → "Showing 2 of 75"
    expect(screen.getByText("Showing 2 of 75")).toBeDefined();
  });

  it("does not show truncation notice when total === items.length", async () => {
    const items = [makeExpense()];
    mockFetch.mockResolvedValue({ items, total: 1 });

    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("Tower Block"));

    expect(screen.queryByText(/Showing \d+ of \d+/)).toBeNull();
  });
});
