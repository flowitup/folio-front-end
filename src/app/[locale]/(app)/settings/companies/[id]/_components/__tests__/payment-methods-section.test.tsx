/**
 * Tests for PaymentMethodsSection component.
 *
 * Covers:
 * - Initial render: method list, builtin badge, usage_count badge
 * - Inline add: typing label + submitting → list refreshes
 * - Delete non-builtin: opens confirm dialog → confirming removes row
 * - Delete builtin: button disabled
 * - Inline edit (builtin): rename works via PATCH
 * - Duplicate label error → toast.error
 * - usageCount > 0 → usage badge rendered
 *
 * Interaction strategy: fireEvent.change for inputs (no userEvent + fake timers),
 * fireEvent.click for buttons. Heavy async tests use { timeout: 15000 }.
 *
 * Sonner mock uses the `as unknown as` cast pattern from bulk-add-form.test.tsx.
 * next-intl resolves real en.json keys via the redeem-invite-token-dialog pattern.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { PaymentMethodsSection } from "../payment-methods-section";

// ---- Mocks ----

vi.mock("next-intl", () => {
  // Simple flat-key mock — avoids ICU plural parsing issues in jsdom.
  // Keys are mapped to predictable English strings that tests can assert against.
  const translations: Record<string, Record<string, string>> = {
    paymentMethods: {
      title: "Payment methods",
      description: "Manage payment methods.",
      addPlaceholder: "e.g. Wise, Stripe, …",
      addButton: "Add",
      builtin: "Built-in",
      noMethods: "No payment methods yet.",
      // usedInInvoices: rendered as "{count} invoices" by the mock (bypasses ICU)
      usedInInvoices: "{count} invoices",
      deleteConfirmTitle: "Remove this payment method?",
      deleteConfirmBody: "Existing invoices keep their snapshot label.",
      deleteConfirmCta: "Remove",
      cancel: "Cancel",
      cancelEditAria: "Cancel edit",
      editLabelAria: 'Edit "{name}"',
      deleteLabelAria: 'Delete "{name}"',
      "errors.duplicate_label": "A payment method with this name already exists.",
      "errors.builtin_protected": "Built-in methods cannot be removed.",
      "errors.not_found": "Payment method not found.",
      "errors.permission_denied": "You don't have permission.",
      "errors.label_required": "Name is required.",
      "toasts.created": "Payment method added",
      "toasts.renamed": "Payment method renamed",
      "toasts.deleted": "Payment method removed",
    },
  };

  const makeT = (ns: string) => (key: string, params?: Record<string, unknown>) => {
    const nsMap = translations[ns] ?? {};
    const raw = nsMap[key] ?? `${ns}.${key}`;
    if (!params) return raw;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      raw
    );
  };
  return { useTranslations: (ns: string) => makeT(ns) };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock(
  "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions",
  () => ({
    createPaymentMethodAction: vi.fn(),
    updatePaymentMethodAction: vi.fn(),
    deletePaymentMethodAction: vi.fn(),
  })
);

// ---- Imports after mocks ----

import { toast } from "sonner";
import {
  createPaymentMethodAction,
  updatePaymentMethodAction,
  deletePaymentMethodAction,
} from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

const mockCreate = vi.mocked(createPaymentMethodAction);
const mockUpdate = vi.mocked(updatePaymentMethodAction);
const mockDelete = vi.mocked(deletePaymentMethodAction);

// ---- Fixtures ----

const COMPANY_ID = "co-test-1";

const BUILTIN_METHOD = {
  id: "pm-builtin-1",
  companyId: COMPANY_ID,
  label: "Cash",
  isBuiltin: true,
  isActive: true,
  usageCount: 3,
};

const CUSTOM_METHOD = {
  id: "pm-custom-1",
  companyId: COMPANY_ID,
  label: "Wise",
  isBuiltin: false,
  isActive: true,
  usageCount: 0,
};

const INITIAL_METHODS = [BUILTIN_METHOD, CUSTOM_METHOD];

function renderSection(initial = INITIAL_METHODS, companyId = COMPANY_ID) {
  return render(
    <PaymentMethodsSection initial={initial} companyId={companyId} />
  );
}

// ---- Tests ----

describe("PaymentMethodsSection — initial render", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all initial methods by label", () => {
    renderSection();
    expect(screen.getByText("Cash")).toBeDefined();
    expect(screen.getByText("Wise")).toBeDefined();
  });

  it("renders 'Built-in' badge for builtin methods", () => {
    renderSection();
    // The badge text comes from paymentMethods.builtin = "Built-in"
    const badges = screen.getAllByText("Built-in");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("does NOT render built-in badge for custom methods", () => {
    renderSection([CUSTOM_METHOD]);
    expect(screen.queryByText("Built-in")).toBeNull();
  });

  it("renders usage count text for methods with usageCount > 0", () => {
    renderSection();
    // usedInInvoices mock renders "{count} invoices" → "3 invoices"
    expect(screen.getByText("3 invoices")).toBeDefined();
  });

  it("does NOT render usage count badge for methods with usageCount=0", () => {
    renderSection([CUSTOM_METHOD]);
    // The usage span should not appear at all for a method with usageCount=0.
    // We check for the specific pattern our mock produces: "<n> invoices".
    expect(screen.queryByText(/\d+ invoices/)).toBeNull();
  });

  it("renders delete button disabled for builtin methods", () => {
    renderSection();
    const deleteBtn = screen.getByRole("button", { name: /Delete "Cash"/i });
    expect(deleteBtn).toBeDisabled();
  });

  it("renders delete button enabled for non-builtin methods", () => {
    renderSection();
    const deleteBtn = screen.getByRole("button", { name: /Delete "Wise"/i });
    expect(deleteBtn).not.toBeDisabled();
  });

  it("renders add form input and button", () => {
    renderSection();
    expect(screen.getByRole("textbox", { name: /e\.g\./i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Add/i })).toBeDefined();
  });
});

describe("PaymentMethodsSection — inline add", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "typing a label and submitting calls createPaymentMethodAction and refreshes list",
    async () => {
      const newMethod = {
        id: "pm-new-1",
        companyId: COMPANY_ID,
        label: "Stripe",
        isBuiltin: false,
        isActive: true,
        usageCount: 0,
      };
      const refreshedList = [...INITIAL_METHODS, newMethod];
      mockCreate.mockResolvedValueOnce({ ok: true, data: refreshedList });

      renderSection();

      const input = screen.getByRole("textbox", { name: /e\.g\./i });
      fireEvent.change(input, { target: { value: "Stripe" } });

      const addBtn = screen.getByRole("button", { name: /Add/i });
      await act(async () => {
        fireEvent.click(addBtn);
      });

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(COMPANY_ID, "Stripe");
        expect(mockToast.success).toHaveBeenCalled();
        expect(screen.getByText("Stripe")).toBeDefined();
      });
    },
    15000
  );

  it(
    "duplicate label error shows toast.error",
    async () => {
      mockCreate.mockResolvedValueOnce({
        ok: false,
        error: {
          code: "duplicate_label",
          message: "A payment method with this label already exists.",
        },
      });

      renderSection();

      const input = screen.getByRole("textbox", { name: /e\.g\./i });
      fireEvent.change(input, { target: { value: "Cash" } });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Add/i }));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    },
    15000
  );

  it("add button disabled when input is empty", () => {
    renderSection();
    const addBtn = screen.getByRole("button", { name: /Add/i });
    expect(addBtn).toBeDisabled();
  });
});

describe("PaymentMethodsSection — delete flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "clicking delete on non-builtin opens confirm dialog",
    async () => {
      renderSection();
      const deleteBtn = screen.getByRole("button", { name: /Delete "Wise"/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        // Dialog title from paymentMethods.deleteConfirmTitle
        expect(screen.getByText(/Remove this payment method/i)).toBeDefined();
      });
    }
  );

  it(
    "confirming delete calls deletePaymentMethodAction and refreshes list",
    async () => {
      const listAfterDelete = [BUILTIN_METHOD];
      mockDelete.mockResolvedValueOnce({ ok: true, data: listAfterDelete });

      renderSection();

      // Open confirm dialog
      fireEvent.click(screen.getByRole("button", { name: /Delete "Wise"/i }));
      await waitFor(() => {
        expect(screen.getByText(/Remove this payment method/i)).toBeDefined();
      });

      // Click confirm button (deleteConfirmCta = "Remove")
      const confirmBtn = screen.getByRole("button", { name: /^Remove$/i });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(mockDelete).toHaveBeenCalledWith(COMPANY_ID, CUSTOM_METHOD.id);
        expect(mockToast.success).toHaveBeenCalled();
        // Wise should be gone from the list
        expect(screen.queryByText("Wise")).toBeNull();
      });
    },
    15000
  );

  it(
    "delete action error shows toast.error",
    async () => {
      mockDelete.mockResolvedValueOnce({
        ok: false,
        error: { code: "not_found", message: "Payment method not found." },
      });

      renderSection();

      fireEvent.click(screen.getByRole("button", { name: /Delete "Wise"/i }));
      await waitFor(() => {
        expect(screen.getByText(/Remove this payment method/i)).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Remove$/i }));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    },
    15000
  );
});

describe("PaymentMethodsSection — inline edit / rename", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "clicking edit on any method (including builtin) opens inline input",
    async () => {
      renderSection();
      const editBtn = screen.getByRole("button", { name: /Edit "Cash"/i });
      fireEvent.click(editBtn);

      await waitFor(() => {
        // An input with the current label value should appear
        const input = screen.getByDisplayValue("Cash");
        expect(input).toBeDefined();
      });
    }
  );

  it(
    "saving a rename calls updatePaymentMethodAction with new label",
    async () => {
      const renamedMethod = { ...BUILTIN_METHOD, label: "Cash (renamed)" };
      mockUpdate.mockResolvedValueOnce({ ok: true, data: [renamedMethod, CUSTOM_METHOD] });

      renderSection();

      // Enter edit mode for the builtin
      fireEvent.click(screen.getByRole("button", { name: /Edit "Cash"/i }));

      await waitFor(() => {
        expect(screen.getByDisplayValue("Cash")).toBeDefined();
      });

      // Change the value
      const input = screen.getByDisplayValue("Cash");
      fireEvent.change(input, { target: { value: "Cash (renamed)" } });

      // Press Enter to save
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      });

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          COMPANY_ID,
          BUILTIN_METHOD.id,
          { label: "Cash (renamed)" }
        );
      });
    },
    15000
  );

  it(
    "pressing Escape cancels the edit without calling updatePaymentMethodAction",
    async () => {
      renderSection();

      fireEvent.click(screen.getByRole("button", { name: /Edit "Cash"/i }));
      await waitFor(() => {
        expect(screen.getByDisplayValue("Cash")).toBeDefined();
      });

      const input = screen.getByDisplayValue("Cash");
      fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

      await waitFor(() => {
        expect(mockUpdate).not.toHaveBeenCalled();
        // Label is back as text, not in an input
        expect(screen.getByText("Cash")).toBeDefined();
      });
    }
  );

  it(
    "duplicate label error on rename shows toast.error",
    async () => {
      mockUpdate.mockResolvedValueOnce({
        ok: false,
        error: {
          code: "duplicate_label",
          message: "A payment method with this label already exists.",
        },
      });

      renderSection();
      fireEvent.click(screen.getByRole("button", { name: /Edit "Wise"/i }));

      await waitFor(() => {
        expect(screen.getByDisplayValue("Wise")).toBeDefined();
      });

      const input = screen.getByDisplayValue("Wise");
      fireEvent.change(input, { target: { value: "Cash" } });

      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    },
    15000
  );
});
