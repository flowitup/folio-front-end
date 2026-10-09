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
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
    has_bank_refund: false,
    attachments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------


/** The desktop table; phones get the same rows again as cards. */
function table() {
  return within(screen.getByTestId("refundable-table"));
}

describe("RefundableInvoicesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  it("renders rows with project name and colored status label", async () => {
    const expense = makeExpense({ refundable_status: "refund_pending" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);

    // Status label (from en.json: billing.refundable.status.refundPending)
    await waitFor(() => {
      expect(table().getByText("Tower Block")).toBeDefined();
    });
    expect(table().getByText("Refund pending")).toBeDefined();
    expect(table().getByText("INV-2026-001")).toBeDefined();
  });

  it("renders 'refundable' status stamp label", async () => {
    mockFetch.mockResolvedValue({ items: [makeExpense()], total: 1, summary: null });
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(table().getByText("Refundable")).toBeDefined();
    });
  });

  it("renders 'refunded' status stamp label", async () => {
    mockFetch.mockResolvedValue({
      items: [makeExpense({ refundable_status: "refunded" })],
      total: 1,
      summary: null,
    });
    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(table().getByText("Refunded")).toBeDefined();
    });
  });

  it("renders the invoice column header and attachment cell per row", async () => {
    const expense = makeExpense({
      attachments: [{ id: "a1", filename: "receipt.pdf", mime_type: "application/pdf", size_bytes: 1024 }],
    });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    // Header column rendered
    expect(table().getByText("Invoice")).toBeDefined();
    // Stubbed cell rendered with correct count
    const cell = table().getByTestId("attachments-cell");
    expect(cell.getAttribute("data-count")).toBe("1");
  });

  it("shows empty state when list is empty", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0, summary: null });
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

  it("calls setRefundableStatus(id, null) when Remove is selected and confirmed", async () => {
    const user = userEvent.setup();
    const expense = makeExpense();
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    // Open the dropdown via userEvent (Radix requires pointer events)
    const trigger = table().getByRole("button", { name: /change status/i });
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

    // Nothing happens until the confirmation dialog is accepted.
    expect(mockSet).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: /remove/i }));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", null, undefined);
    });
    // After remove the list reloads
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("calls setRefundableStatus(id, 'refunded', 'company') when 'Refunded by company' is selected", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refund_pending" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    const trigger = table().getByRole("button", { name: /change status/i });
    await user.click(trigger);

    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const item = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by company$/i.test(el.textContent?.trim() ?? "")
    )!;
    await user.click(item);

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", "refunded", "company");
    });
  });

  it("calls setRefundableStatus(id, 'refunded', 'bank') when 'Refunded by bank' is selected", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refund_pending" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    const trigger = table().getByRole("button", { name: /change status/i });
    await user.click(trigger);

    await waitFor(() => {
      const items = document.querySelectorAll("[role='menuitem']");
      if (items.length === 0) throw new Error("menu items not rendered");
    });

    const item = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by bank$/i.test(el.textContent?.trim() ?? "")
    )!;
    await user.click(item);

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", "refunded", "bank");
    });
  });

  it("disables 'Refunded by company' when already company-refunded (refunded_by null/company)", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refunded", refunded_by: null });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    await user.click(table().getByRole("button", { name: /change status/i }));
    await waitFor(() => {
      if (document.querySelectorAll("[role='menuitem']").length === 0) {
        throw new Error("menu items not rendered");
      }
    });

    const byCompany = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by company$/i.test(el.textContent?.trim() ?? "")
    )!;
    const byBank = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by bank$/i.test(el.textContent?.trim() ?? "")
    )!;
    expect(byCompany.getAttribute("data-disabled")).not.toBeNull();
    expect(byBank.getAttribute("data-disabled")).toBeNull();
  });

  it("disables 'Refunded by bank' when already bank-refunded", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refunded", refunded_by: "bank" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    await user.click(table().getByRole("button", { name: /change status/i }));
    await waitFor(() => {
      if (document.querySelectorAll("[role='menuitem']").length === 0) {
        throw new Error("menu items not rendered");
      }
    });

    const byCompany = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by company$/i.test(el.textContent?.trim() ?? "")
    )!;
    const byBank = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by bank$/i.test(el.textContent?.trim() ?? "")
    )!;
    expect(byBank.getAttribute("data-disabled")).not.toBeNull();
    expect(byCompany.getAttribute("data-disabled")).toBeNull();
  });

  it("calls setRefundableStatus(id, 'refunded', 'both') when 'Refunded by company + bank' is selected", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refunded", refunded_by: "bank" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    await user.click(table().getByRole("button", { name: /change status/i }));
    await waitFor(() => {
      if (document.querySelectorAll("[role='menuitem']").length === 0) {
        throw new Error("menu items not rendered");
      }
    });

    const item = Array.from(document.querySelectorAll("[role='menuitem']")).find(
      (el) => /^refunded by company \+ bank$/i.test(el.textContent?.trim() ?? "")
    )!;
    await user.click(item);

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("exp-1", "refunded", "both");
    });
  });

  it("disables only the 'both' item when already refunded by both", async () => {
    const user = userEvent.setup();
    const expense = makeExpense({ refundable_status: "refunded", refunded_by: "both" });
    mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    await user.click(table().getByRole("button", { name: /change status/i }));
    await waitFor(() => {
      if (document.querySelectorAll("[role='menuitem']").length === 0) {
        throw new Error("menu items not rendered");
      }
    });

    const items = Array.from(document.querySelectorAll("[role='menuitem']"));
    const byCompany = items.find((el) => /^refunded by company$/i.test(el.textContent?.trim() ?? ""))!;
    const byBank = items.find((el) => /^refunded by bank$/i.test(el.textContent?.trim() ?? ""))!;
    const byBoth = items.find(
      (el) => /^refunded by company \+ bank$/i.test(el.textContent?.trim() ?? "")
    )!;
    expect(byBoth.getAttribute("data-disabled")).not.toBeNull();
    expect(byCompany.getAttribute("data-disabled")).toBeNull();
    expect(byBank.getAttribute("data-disabled")).toBeNull();
  });

  it("opens the Add dialog when the Add button is clicked", async () => {
    mockFetch.mockResolvedValue({ items: [], total: 0, summary: null });
    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("No refundable expenses yet."));

    fireEvent.click(screen.getByText("Add refundable expense"));
    expect(screen.getByTestId("add-dialog")).toBeDefined();
  });

  it("shows truncation notice when total > items.length", async () => {
    const items = [makeExpense({ id: "exp-1" }), makeExpense({ id: "exp-2", invoice_number: "INV-002" })];
    mockFetch.mockResolvedValue({ items, total: 75, summary: null });

    render(<RefundableInvoicesPage />);
    // Two rows with "Tower Block" — wait for the unique invoice number instead
    await waitFor(() => table().getByText("INV-002"));

    // en.json: "Showing {count} of {total}" → "Showing 2 of 75"
    expect(screen.getByText("Showing 2 of 75")).toBeDefined();
  });

  it("does not show truncation notice when total === items.length", async () => {
    const items = [makeExpense()];
    mockFetch.mockResolvedValue({ items, total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));

    expect(screen.queryByText(/Showing \d+ of \d+/)).toBeNull();
  });

  it("renders summary cards when the fetch returns a non-null summary", async () => {
    mockFetch.mockResolvedValue({
      items: [makeExpense()],
      total: 1,
      summary: {
        refundable_amount: 500,
        refunded_total: 1000,
        refunded_by_company: 600,
        refunded_by_bank: 400,
        refunded_by_both: 0,
      },
    });

    render(<RefundableInvoicesPage />);
    await waitFor(() => {
      expect(screen.getByTestId("refundable-summary-cards")).toBeDefined();
    });
  });

  it("renders summary cards even when the list is empty (non-null summary)", async () => {
    mockFetch.mockResolvedValue({
      items: [],
      total: 0,
      summary: {
        refundable_amount: 0,
        refunded_total: 0,
        refunded_by_company: 0,
        refunded_by_bank: 0,
        refunded_by_both: 0,
      },
    });

    render(<RefundableInvoicesPage />);
    await waitFor(() => screen.getByText("No refundable expenses yet."));
    expect(screen.getByTestId("refundable-summary-cards")).toBeDefined();
  });

  it("renders nothing for summary cards when summary is null", async () => {
    mockFetch.mockResolvedValue({ items: [makeExpense()], total: 1, summary: null });

    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("Tower Block"));
    expect(screen.queryByTestId("refundable-summary-cards")).toBeNull();
  });

  describe("linked funds-release number", () => {
    it("renders the FR number when the expense has a linked release", async () => {
      const expense = makeExpense({
        refundable_status: "refunded",
        refunded_by: "bank",
        funds_release_number: "FR-2026-0004",
      });
      mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

      render(<RefundableInvoicesPage />);
      await waitFor(() => table().getByText("Tower Block"));

      const chip = table().getByTestId("funds-release-number");
      expect(chip.textContent).toBe("FR-2026-0004");
      expect(chip.getAttribute("title")).toBe("Funds released: FR-2026-0004");
      // Non-interactive span: title alone is invisible to screen readers,
      // so the same localized string must also be exposed via aria-label.
      expect(chip.getAttribute("aria-label")).toBe("Funds released: FR-2026-0004");
    });

    it("renders nothing when no release is linked", async () => {
      const expense = makeExpense({
        refundable_status: "refunded",
        refunded_by: "company",
      });
      mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

      render(<RefundableInvoicesPage />);
      await waitFor(() => table().getByText("Tower Block"));

      expect(table().queryByTestId("funds-release-number")).toBeNull();
    });

    it("renders nothing when funds_release_number is explicitly null", async () => {
      const expense = makeExpense({
        refundable_status: "refunded",
        refunded_by: "bank",
        funds_release_number: null,
      });
      mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

      render(<RefundableInvoicesPage />);
      await waitFor(() => table().getByText("Tower Block"));

      expect(table().queryByTestId("funds-release-number")).toBeNull();
    });

    it("shows the bank source icon alongside the FR chip", async () => {
      const expense = makeExpense({
        refundable_status: "refunded",
        refunded_by: "bank",
        funds_release_number: "FR-2026-0007",
      });
      mockFetch.mockResolvedValue({ items: [expense], total: 1, summary: null });

      render(<RefundableInvoicesPage />);
      await waitFor(() => table().getByText("Tower Block"));

      expect(table().getByTestId("refund-source-bank")).toBeDefined();
      expect(table().getByTestId("funds-release-number")).toBeDefined();
    });
  });
});

describe("RefundableInvoicesPage — layouts", () => {
  it("lists each expense as a card on phones, with its status menu on the card", async () => {
    mockFetch.mockResolvedValue({ items: [makeExpense()], total: 1, summary: null });
    render(<RefundableInvoicesPage />);

    const cards = await screen.findByTestId("refundable-cards");
    expect(within(cards).getByText("Tower Block")).toBeInTheDocument();
    expect(within(cards).getByRole("button", { name: /change status/i })).toBeInTheDocument();
  });

  it("puts the status and the menu under their own table headers", async () => {
    mockFetch.mockResolvedValue({ items: [makeExpense()], total: 1, summary: null });
    render(<RefundableInvoicesPage />);

    await waitFor(() => table().getByText("Tower Block"));
    const row = table().getByText("Tower Block").closest("tr")!;
    const cells = row.querySelectorAll("td");
    const headers = screen.getByTestId("refundable-table").querySelectorAll("th");
    expect(cells).toHaveLength(headers.length);
    const last = cells[cells.length - 1];
    expect(within(last as HTMLElement).getByRole("button", { name: /change status/i })).toBeInTheDocument();
    expect(last.querySelector(".stamp")).toBeNull();
  });
});


describe("RefundableInvoicesPage — more than one page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
    const pages = [
      makeExpense({ id: "exp-1", invoice_number: "INV-P1" }),
      makeExpense({ id: "exp-2", invoice_number: "INV-P2" }),
    ];
    mockFetch.mockImplementation(async (params) => ({
      items: [pages[params?.offset ?? 0]],
      total: 2,
      summary: null,
    }));
  });

  it("loads the next page after the loaded rows", async () => {
    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("INV-P1"));
    expect(screen.getByText("Showing 1 of 2")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() => table().getByText("INV-P2"));
    expect(mockFetch).toHaveBeenLastCalledWith({ offset: 1 });
    expect(table().getByText("INV-P1")).toBeDefined();
    expect(screen.queryByText(/Showing \d+ of \d+/)).toBeNull();
  });

  it("keeps the loaded pages after a status change reloads the list", async () => {
    const user = userEvent.setup();
    render(<RefundableInvoicesPage />);
    await waitFor(() => table().getByText("INV-P1"));
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => table().getByText("INV-P2"));

    await user.click(table().getAllByRole("button", { name: /change status/i })[1]);
    await waitFor(() => {
      if (document.querySelectorAll("[role='menuitem']").length === 0) throw new Error("menu items not rendered");
    });
    const removeItem = Array.from(document.querySelectorAll("[role='menuitem']")).find((el) =>
      /remove/i.test(el.textContent ?? "")
    )!;
    await user.click(removeItem);
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: /remove/i }));

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("exp-2", null, undefined));
    // First page, then the second again: both rows stay on screen.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4));
    expect(mockFetch).toHaveBeenLastCalledWith({ offset: 1 });
    await waitFor(() => table().getByText("INV-P2"));
    expect(table().getByText("INV-P1")).toBeDefined();
  });
});
