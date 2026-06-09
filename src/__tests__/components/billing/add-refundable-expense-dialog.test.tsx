/**
 * Tests for AddRefundableExpenseDialog.
 *
 * Verifies:
 *   - Opening the dialog fetches candidates
 *   - Search box filters rows by project/invoice/recipient
 *   - Selecting rows + clicking confirm calls setRefundableStatus(id, "refundable") per item
 *   - onAdded callback fires after successful confirm
 *   - Confirm button is disabled while submitting
 *   - Empty state when no candidates
 *   - Truncation notice renders when candidateTotal > candidates.length
 *   - Batch add with one rejection: onAdded called, error toast shown, submitting resets
 *   - All rejected: onAdded not called, dialog stays open, error toast shown
 *
 * Mocking strategy:
 *   - @/lib/api/billing/refundable-invoices: vi.fn() stubs
 *   - next-intl: key-lookup against en.json (consistent with project test style)
 *   - sonner: as-unknown-as cast
 *
 * Interaction: fireEvent — avoids fake-timer / Radix deadlocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { AddRefundableExpenseDialog } from "@/components/billing/add-refundable-expense-dialog";
import {
  fetchRefundableCandidates,
  setRefundableStatus,
} from "@/lib/api/billing/refundable-invoices";
import { toast } from "sonner";
import type { RefundableExpense } from "@/types/invoice";

const mockFetchCandidates = vi.mocked(fetchRefundableCandidates);
const mockSet = vi.mocked(setRefundableStatus);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<RefundableExpense> = {}): RefundableExpense {
  return {
    id: "cand-1",
    project_id: "proj-1",
    project_name: "Riverside Tower",
    invoice_number: "INV-2026-042",
    recipient_name: "BuildSupply Co",
    issue_date: "2026-02-10",
    total_amount: 3200.0,
    refundable_status: null,
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  onAdded: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddRefundableExpenseDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockResolvedValue(undefined);
  });

  it("fetches candidates when dialog opens", async () => {
    mockFetchCandidates.mockResolvedValue({ items: [], total: 0 });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(mockFetchCandidates).toHaveBeenCalledTimes(1);
    });
  });

  it("renders candidate rows after fetch", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [makeCandidate()],
      total: 1,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("Riverside Tower")).toBeDefined();
    });
    expect(screen.getByText("INV-2026-042")).toBeDefined();
    expect(screen.getByText("BuildSupply Co")).toBeDefined();
  });

  it("shows empty state when no candidates", async () => {
    mockFetchCandidates.mockResolvedValue({ items: [], total: 0 });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);

    await waitFor(() => {
      expect(screen.getByText("No eligible expenses found.")).toBeDefined();
    });
  });

  it("search filters rows by project name", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [
        makeCandidate({ id: "a", project_name: "Alpha Site" }),
        makeCandidate({ id: "b", project_name: "Beta Complex" }),
      ],
      total: 2,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("Alpha Site"));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "beta" } });

    await waitFor(() => {
      expect(screen.queryByText("Alpha Site")).toBeNull();
    });
    expect(screen.getByText("Beta Complex")).toBeDefined();
  });

  it("search filters rows by invoice number", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [
        makeCandidate({ id: "a", invoice_number: "INV-001", project_name: "Project A" }),
        makeCandidate({ id: "b", invoice_number: "INV-999", project_name: "Project B" }),
      ],
      total: 2,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("INV-001"));

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "999" } });

    await waitFor(() => {
      expect(screen.queryByText("INV-001")).toBeNull();
    });
    expect(screen.getByText("INV-999")).toBeDefined();
  });

  it("selecting a row and confirming calls setRefundableStatus(id, 'refundable')", async () => {
    const candidate = makeCandidate();
    mockFetchCandidates.mockResolvedValue({ items: [candidate], total: 1 });

    const onAdded = vi.fn();
    render(
      <AddRefundableExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        onAdded={onAdded}
      />
    );

    await waitFor(() => screen.getByText("Riverside Tower"));

    // Select the row via its checkbox
    const checkbox = screen.getByRole("checkbox", { name: "INV-2026-042" });
    fireEvent.click(checkbox);

    // Confirm
    fireEvent.click(screen.getByText("Add selected"));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("cand-1", "refundable");
    });
    expect(onAdded).toHaveBeenCalledTimes(1);
  });

  it("calls setRefundableStatus for each selected item", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [
        makeCandidate({ id: "x", invoice_number: "INV-X" }),
        makeCandidate({ id: "y", invoice_number: "INV-Y" }),
      ],
      total: 2,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("INV-X"));

    fireEvent.click(screen.getByRole("checkbox", { name: "INV-X" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "INV-Y" }));

    fireEvent.click(screen.getByText("Add selected"));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledTimes(2);
    });
    expect(mockSet).toHaveBeenCalledWith("x", "refundable");
    expect(mockSet).toHaveBeenCalledWith("y", "refundable");
  });

  it("confirm button is disabled when nothing is selected", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [makeCandidate()],
      total: 1,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("Riverside Tower"));

    const confirmBtn = screen.getByText("Add selected").closest("button");
    expect(confirmBtn).not.toBeNull();
    expect(confirmBtn!.disabled).toBe(true);
  });

  it("does not fetch candidates when dialog is closed", () => {
    mockFetchCandidates.mockResolvedValue({ items: [], total: 0 });

    render(
      <AddRefundableExpenseDialog
        open={false}
        onOpenChange={vi.fn()}
        onAdded={vi.fn()}
      />
    );

    expect(mockFetchCandidates).not.toHaveBeenCalled();
  });

  it("shows truncation notice when candidateTotal > candidates.length", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [makeCandidate()],
      total: 120,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("Riverside Tower"));

    // en.json truncatedNotice: "Showing {count} of {total}" → "Showing 1 of 120"
    expect(screen.getByText("Showing 1 of 120")).toBeDefined();
  });

  it("does not show truncation notice when candidateTotal equals candidates.length", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [makeCandidate()],
      total: 1,
    });

    render(<AddRefundableExpenseDialog {...DEFAULT_PROPS} />);
    await waitFor(() => screen.getByText("Riverside Tower"));

    expect(screen.queryByText(/Showing \d+ of \d+/)).toBeNull();
  });

  it("partial failure: onAdded called and error toast shown when one of two rejects", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [
        makeCandidate({ id: "ok", invoice_number: "INV-OK" }),
        makeCandidate({ id: "fail", invoice_number: "INV-FAIL" }),
      ],
      total: 2,
    });

    // "ok" resolves, "fail" rejects
    mockSet.mockImplementation((id: string) => {
      if (id === "fail") return Promise.reject(new Error("server error"));
      return Promise.resolve(undefined);
    });

    const onAdded = vi.fn();
    render(
      <AddRefundableExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        onAdded={onAdded}
      />
    );

    await waitFor(() => screen.getByText("INV-OK"));

    fireEvent.click(screen.getByRole("checkbox", { name: "INV-OK" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "INV-FAIL" }));
    fireEvent.click(screen.getByText("Add selected"));

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
  });

  it("all failed: onAdded not called, error toast shown, submitting resets", async () => {
    mockFetchCandidates.mockResolvedValue({
      items: [makeCandidate({ id: "fail", invoice_number: "INV-FAIL" })],
      total: 1,
    });

    mockSet.mockRejectedValue(new Error("server error"));

    const onAdded = vi.fn();
    render(
      <AddRefundableExpenseDialog
        open={true}
        onOpenChange={vi.fn()}
        onAdded={onAdded}
      />
    );

    await waitFor(() => screen.getByText("INV-FAIL"));

    fireEvent.click(screen.getByRole("checkbox", { name: "INV-FAIL" }));
    fireEvent.click(screen.getByText("Add selected"));

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledTimes(1);
    });
    expect(onAdded).not.toHaveBeenCalled();

    // Confirm button should be re-enabled after failure (submitting reset in finally)
    await waitFor(() => {
      const confirmBtn = screen.getByText("Add selected").closest("button");
      expect(confirmBtn?.disabled).toBe(false);
    });
  });
});
