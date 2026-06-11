/**
 * Tests for PaymentMethodRow — isCompanyPayment badge and edit checkbox.
 *
 * Covers:
 * - "Paid by the company" badge renders on rows with isCompanyPayment=true
 * - Badge absent when isCompanyPayment=false
 * - Edit mode shows the paidByCompany checkbox
 * - Saving with checkbox ticked calls onRenameRequest with isCompanyPayment=true
 * - Saving with checkbox unticked calls onRenameRequest with isCompanyPayment=false
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { PaymentMethodRow } from "../payment-method-row";
import type { PaymentMethod } from "@/lib/api/payment-methods-api";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    const map: Record<string, Record<string, string>> = {
      paymentMethods: {
        title: "Payment methods",
        builtin: "Built-in",
        paidByCompany: "Paid by the company",
        usedInInvoices: "{count} invoices",
        cancelEditAria: "Cancel edit",
        editLabelAria: 'Edit "{name}"',
        deleteLabelAria: 'Delete "{name}"',
        deleteConfirmCta: "Remove",
      },
      "paymentMethods.builtins": {
        cash: "Cash",
      },
    };
    const ns = namespace ?? "";
    return (key: string, params?: Record<string, unknown>) => {
      const raw = map[ns]?.[key] ?? `${ns}.${key}`;
      if (!params) return raw;
      return Object.entries(params).reduce<string>(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        raw,
      );
    };
  },
}));

vi.mock("@/lib/payment-methods/localize-method-label", () => ({
  localizeMethodLabel: (label: string) => label,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPANY_ID = "co-test-1";

function makeMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: "pm-row-1",
    companyId: COMPANY_ID,
    label: "Wise",
    isBuiltin: false,
    isActive: true,
    usageCount: 0,
    isCompanyPayment: false,
    ...overrides,
  };
}

function renderRow(
  method: PaymentMethod,
  onRenameRequest = vi.fn().mockResolvedValue(undefined),
  onDeleteRequest = vi.fn(),
) {
  return render(
    <PaymentMethodRow
      method={method}
      isMutating={false}
      onRenameRequest={onRenameRequest}
      onDeleteRequest={onDeleteRequest}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => vi.clearAllMocks());

describe("PaymentMethodRow — paidByCompany badge", () => {
  it("renders 'Paid by the company' badge when isCompanyPayment=true", () => {
    renderRow(makeMethod({ isCompanyPayment: true }));
    expect(screen.getByText("Paid by the company")).toBeDefined();
  });

  it("does NOT render paidByCompany badge when isCompanyPayment=false", () => {
    renderRow(makeMethod({ isCompanyPayment: false }));
    expect(screen.queryByText("Paid by the company")).toBeNull();
  });
});

describe("PaymentMethodRow — edit mode shows paidByCompany checkbox", () => {
  it("checkbox is visible after clicking Edit", async () => {
    renderRow(makeMethod({ isCompanyPayment: false }));

    fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));

    await waitFor(() => {
      // The label for the checkbox should appear
      expect(screen.getByText("Paid by the company")).toBeDefined();
      // The checkbox input should be present and unchecked
      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDefined();
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    });
  });

  it("checkbox is pre-checked when isCompanyPayment=true", async () => {
    renderRow(makeMethod({ isCompanyPayment: true }));

    fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));

    await waitFor(() => {
      const checkbox = screen.getByRole("checkbox");
      expect((checkbox as HTMLInputElement).checked).toBe(true);
    });
  });
});

describe("PaymentMethodRow — save submits isCompanyPayment", () => {
  it(
    "submits isCompanyPayment=true when checkbox is ticked before saving",
    async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      renderRow(makeMethod({ isCompanyPayment: false }), onRename);

      // Open edit mode
      fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));
      await waitFor(() => expect(screen.getByRole("checkbox")).toBeDefined());

      // Tick the checkbox
      fireEvent.click(screen.getByRole("checkbox"));

      // Press Enter to save
      await act(async () => {
        fireEvent.keyDown(screen.getByDisplayValue("Wise"), {
          key: "Enter",
          code: "Enter",
        });
      });

      await waitFor(() => {
        expect(onRename).toHaveBeenCalledWith("pm-row-1", "Wise", true);
      });
    },
    15000,
  );

  it(
    "submits isCompanyPayment=false when checkbox is unticked before saving",
    async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      renderRow(makeMethod({ isCompanyPayment: true }), onRename);

      // Open edit mode
      fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));
      await waitFor(() => {
        const cb = screen.getByRole("checkbox");
        expect((cb as HTMLInputElement).checked).toBe(true);
      });

      // Untick the checkbox
      fireEvent.click(screen.getByRole("checkbox"));

      await act(async () => {
        fireEvent.keyDown(screen.getByDisplayValue("Wise"), {
          key: "Enter",
          code: "Enter",
        });
      });

      await waitFor(() => {
        expect(onRename).toHaveBeenCalledWith("pm-row-1", "Wise", false);
      });
    },
    15000,
  );

  it(
    "no network call when nothing changed (label same, checkbox same)",
    async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      renderRow(makeMethod({ isCompanyPayment: false }), onRename);

      fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));
      await waitFor(() => expect(screen.getByDisplayValue("Wise")).toBeDefined());

      // Press Enter without changing anything
      await act(async () => {
        fireEvent.keyDown(screen.getByDisplayValue("Wise"), {
          key: "Enter",
          code: "Enter",
        });
      });

      await waitFor(() => {
        expect(onRename).not.toHaveBeenCalled();
      });
    },
    15000,
  );
});
