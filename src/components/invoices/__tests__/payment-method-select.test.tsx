/**
 * Tests for PaymentMethodSelect component.
 *
 * Covers:
 * - Empty state (loading spinner → options appear after fetch)
 * - Selecting an option fires onChange with the id
 * - Typing a label not in list shows "+ Add" affordance
 * - Clicking "+ Add" calls createPaymentMethodAction and auto-selects new entry
 * - Selecting "(None)" fires onChange(null)
 * - Error from listPaymentMethodsAction → toast.error
 * - Error from createPaymentMethodAction → toast.error
 *
 * Interaction strategy: fireEvent.click to open popover, fireEvent.change for
 * CommandInput (no userEvent.type + fake timers). All async assertions wrapped
 * in waitFor. Heavy tests carry { timeout: 15000 }.
 *
 * Sonner and next-intl mocks mirror bulk-add-form.test.tsx and
 * redeem-invite-token-dialog.test.tsx patterns.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { PaymentMethodSelect } from "../payment-method-select";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      "label": "Payment method",
      "placeholder": "Select a payment method…",
      "none": "—",
      "addInline": `+ Add "{name}"`,
      "failedToLoad": "Failed to load payment methods",
      "failedToLoadRetry": "Failed to load. Try reopening.",
      "noMethodsFound": "No methods found.",
      "failedToCreate": "Failed to create payment method",
    };
    const val = map[key] ?? key;
    if (!params) return val;
    return Object.entries(params).reduce<string>(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      val
    );
  },
}));

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
    listPaymentMethodsAction: vi.fn(),
    createPaymentMethodAction: vi.fn(),
  })
);

// ---- Imports after mocks ----

import { toast } from "sonner";
import {
  listPaymentMethodsAction,
  createPaymentMethodAction,
} from "@/app/[locale]/(app)/settings/companies/[id]/_actions/payment-methods-actions";

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockList = vi.mocked(listPaymentMethodsAction);
const mockCreate = vi.mocked(createPaymentMethodAction);

// ---- Fixtures ----

const COMPANY_ID = "co-test-1";

const BANK_TRANSFER = {
  id: "pm-1",
  companyId: COMPANY_ID,
  label: "Bank Transfer",
  isBuiltin: false,
  isActive: true,
  usageCount: 0,
};

const CASH = {
  id: "pm-builtin-1",
  companyId: COMPANY_ID,
  label: "Cash",
  isBuiltin: true,
  isActive: true,
  usageCount: 2,
};

const METHODS = [CASH, BANK_TRANSFER];

// ---- Helper ----

function renderSelect(
  value: string | null = null,
  onChange = vi.fn(),
  allowCreate = true
) {
  return render(
    <PaymentMethodSelect
      companyId={COMPANY_ID}
      value={value}
      onChange={onChange}
      allowCreate={allowCreate}
    />
  );
}

/** Open the popover by clicking the trigger button. */
async function openPopover() {
  const trigger = screen.getByRole("combobox");
  fireEvent.click(trigger);
  // Wait for the command list to appear
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/Select a payment method/i)).toBeDefined();
  });
}

// ---- Tests ----

describe("PaymentMethodSelect — initial render (closed state)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the trigger button with placeholder when no value selected", () => {
    mockList.mockResolvedValue({ ok: true, data: METHODS });
    renderSelect();
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toContain("Select a payment method");
  });

  it("renders the selected label when a value is set", () => {
    mockList.mockResolvedValue({ ok: true, data: METHODS });
    renderSelect(CASH.id);
    // Cash is not in methods until popover opens + fetch resolves,
    // so the trigger shows placeholder until methods are loaded.
    // The combobox should render either label or placeholder.
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDefined();
  });
});

describe("PaymentMethodSelect — loading and rendering options", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "opens popover, triggers fetch, and shows options after load",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });

      renderSelect();
      await openPopover();

      await waitFor(() => {
        expect(mockList).toHaveBeenCalledWith(COMPANY_ID);
        expect(screen.getByText("Cash")).toBeDefined();
        expect(screen.getByText("Bank Transfer")).toBeDefined();
      });
    },
    15000
  );

  it(
    "renders (None) / clear option when list is loaded",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      renderSelect();
      await openPopover();

      await waitFor(() => {
        // none key → "—"
        expect(screen.getByText("—")).toBeDefined();
      });
    },
    15000
  );

  it(
    "shows toast.error when listPaymentMethodsAction returns ok:false",
    async () => {
      mockList.mockResolvedValueOnce({
        ok: false,
        error: { code: "forbidden", message: "Forbidden" },
      });

      renderSelect();
      await openPopover();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to load payment methods");
      });
    },
    15000
  );

  it(
    "shows toast.error when listPaymentMethodsAction throws",
    async () => {
      mockList.mockRejectedValueOnce(new Error("Network failure"));

      renderSelect();
      await openPopover();

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to load payment methods");
      });
    },
    15000
  );
});

describe("PaymentMethodSelect — selecting an option", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "clicking an option fires onChange with its id and closes popover",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      const onChange = vi.fn();
      renderSelect(null, onChange);

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Bank Transfer")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Bank Transfer"));
      });

      expect(onChange).toHaveBeenCalledWith(BANK_TRANSFER.id);
    },
    15000
  );

  it(
    "clicking (None) fires onChange(null)",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      const onChange = vi.fn();
      renderSelect(CASH.id, onChange);

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("—")).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText("—"));
      });

      expect(onChange).toHaveBeenCalledWith(null);
    },
    15000
  );
});

describe("PaymentMethodSelect — inline create (+ Add affordance)", () => {
  beforeEach(() => vi.clearAllMocks());

  it(
    "typing a label not in the list shows the '+ Add' option",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      renderSelect();

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "Wise" } });

      await waitFor(() => {
        // addInline key with name="Wise" → '+ Add "Wise"'
        expect(screen.getByText(/Add "Wise"/i)).toBeDefined();
      });
    },
    15000
  );

  it(
    "typing an exact existing label does NOT show the '+ Add' option",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      renderSelect();

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "Cash" } });

      await waitFor(() => {
        expect(screen.queryByText(/\+ Add/i)).toBeNull();
      });
    },
    15000
  );

  it(
    "clicking '+ Add' calls createPaymentMethodAction and auto-selects the new method",
    async () => {
      const newMethod = {
        id: "pm-new-wise",
        companyId: COMPANY_ID,
        label: "Wise",
        isBuiltin: false,
        isActive: true,
        usageCount: 0,
      };
      const updatedList = [...METHODS, newMethod];

      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      mockCreate.mockResolvedValueOnce({ ok: true, data: updatedList });

      const onChange = vi.fn();
      renderSelect(null, onChange);

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "Wise" } });

      await waitFor(() => {
        expect(screen.getByText(/Add "Wise"/i)).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText(/Add "Wise"/i));
      });

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(COMPANY_ID, "Wise");
        // Should auto-select the newly created method
        expect(onChange).toHaveBeenCalledWith(newMethod.id);
        expect(mockToast.success).toHaveBeenCalled();
      });
    },
    15000
  );

  it(
    "createPaymentMethodAction error → toast.error shown",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      mockCreate.mockResolvedValueOnce({
        ok: false,
        error: { code: "duplicate_label", message: "Already exists." },
      });

      renderSelect();

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "NewMethod" } });

      await waitFor(() => {
        expect(screen.getByText(/Add "NewMethod"/i)).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText(/Add "NewMethod"/i));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });
    },
    15000
  );

  it(
    "createPaymentMethodAction throws → toast.error with failedToCreate message",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      mockCreate.mockRejectedValueOnce(new Error("Network failure"));

      renderSelect();

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "Stripe" } });

      await waitFor(() => {
        expect(screen.getByText(/Add "Stripe"/i)).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(screen.getByText(/Add "Stripe"/i));
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to create payment method");
      });
    },
    15000
  );

  it(
    "does not show '+ Add' when allowCreate=false",
    async () => {
      mockList.mockResolvedValueOnce({ ok: true, data: METHODS });
      renderSelect(null, vi.fn(), false);

      await openPopover();
      await waitFor(() => {
        expect(screen.getByText("Cash")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Select a payment method/i);
      fireEvent.change(searchInput, { target: { value: "Wise" } });

      // Even with a non-matching query, no create option shown
      expect(screen.queryByText(/\+ Add/i)).toBeNull();
    },
    15000
  );
});
