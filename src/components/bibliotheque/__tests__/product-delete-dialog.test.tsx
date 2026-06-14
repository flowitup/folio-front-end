/**
 * product-delete-dialog.test.tsx — ProductDeleteDialog component tests.
 *
 * Tests: typed-confirm gating (button disabled until name typed); calls
 * deleteProductAction; onDeleted awaited; warning text shows purchase count.
 *
 * Uses AlertDialog shadcn mock to avoid Radix portal issues in jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---- Module mocks (hoisted) ----

vi.mock(
  "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions",
  () => ({
    deleteProductAction: vi.fn(),
  })
);

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    const val = path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj);
    // For ICU patterns return the raw string — tests check substrings not interpolation
    return (typeof val === "string" ? val : path);
  }
  return {
    useTranslations: (ns: string) => (key: string, params?: Record<string, unknown>) => {
      const raw = resolve(en, `${ns}.${key}`);
      // Simple interpolation for {name} and {count} used in deleteWarning
      if (params && typeof raw === "string") {
        return raw
          .replace(/\{name\}/g, String(params.name ?? ""))
          .replace(/\{count,[^}]*\}/g, String(params.count ?? "0"))
          .replace(/\{count\}/g, String(params.count ?? "0"));
      }
      return raw;
    },
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  } as unknown as {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warning: ReturnType<typeof vi.fn>;
  },
}));

// Mock shadcn AlertDialog to avoid Radix portal issues in jsdom
vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  AlertDialogFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  AlertDialogCancel: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type="button" data-testid="cancel-btn" disabled={disabled}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
    disabled,
    style,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    style?: React.CSSProperties;
  }) => (
    <button
      type="button"
      data-testid="delete-btn"
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  ),
}));

// ---- Imports after mocks ----

import { deleteProductAction } from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { toast } from "sonner";
import { ProductDeleteDialog } from "../product-delete-dialog";
import type { LibraryProduct } from "@/lib/api/bibliotheque";

const mockDelete = vi.mocked(deleteProductAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

// ---- Fixtures ----

function makeProduct(overrides?: Partial<LibraryProduct>): LibraryProduct {
  return {
    id: "prod-1",
    company_id: "co-1",
    supplier_id: "sup-1",
    supplier_reference: "REF-001",
    name: "Hammer Drill",
    description: null,
    size: null,
    category: null,
    has_image: false,
    product_url: null,
    purchase_count: 3,
    total_quantity: "5",
    last_unit_price: "10.00",
    first_purchased_at: "2024-01-01T00:00:00Z",
    last_purchased_at: "2024-06-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDialog(props?: {
  product?: LibraryProduct | null;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  onDeleted?: (id: string) => void;
}) {
  // Allow explicit null to test the null-product guard
  const product = Object.prototype.hasOwnProperty.call(props ?? {}, "product")
    ? (props!.product ?? null)
    : makeProduct();
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  const onDeleted = props?.onDeleted ?? vi.fn();
  return render(
    <ProductDeleteDialog
      product={product}
      open={props?.open ?? true}
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
    />
  );
}

// ---- Tests ----

describe("ProductDeleteDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders null when product is null", () => {
    const { container } = renderDialog({ product: null });
    expect(container.firstChild).toBeNull();
  });

  it("does not render when open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("alert-dialog")).not.toBeInTheDocument();
  });

  it("renders the delete title", () => {
    renderDialog();
    expect(screen.getByText("Delete product")).toBeInTheDocument();
  });

  it("renders the product name", () => {
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });
    // product name appears in the dialog (in subtitle)
    const nameEls = screen.getAllByText("Hammer Drill");
    expect(nameEls.length).toBeGreaterThan(0);
  });

  it("renders purchase count in warning text", () => {
    renderDialog({ product: makeProduct({ name: "Saw", purchase_count: 5 }) });
    // The warning text should contain purchase count information
    const content = screen.getByTestId("alert-dialog-content").textContent ?? "";
    expect(content).toContain("5");
  });

  it("delete button is disabled when confirm input is empty", () => {
    renderDialog();
    const deleteBtn = screen.getByTestId("delete-btn");
    expect(deleteBtn).toBeDisabled();
  });

  it("delete button is disabled when confirm text does not match product name", () => {
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Wrong Name" },
    });

    expect(screen.getByTestId("delete-btn")).toBeDisabled();
  });

  it("delete button is enabled when confirm text exactly matches product name", () => {
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });

    expect(screen.getByTestId("delete-btn")).not.toBeDisabled();
  });

  it("calls deleteProductAction with product id on confirm", async () => {
    mockDelete.mockResolvedValueOnce({ ok: true });
    renderDialog({ product: makeProduct({ name: "Hammer Drill", id: "prod-1" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });
    fireEvent.click(screen.getByTestId("delete-btn"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("prod-1");
    });
  });

  it("calls onDeleted with product id after successful delete", async () => {
    mockDelete.mockResolvedValueOnce({ ok: true });
    const onDeleted = vi.fn();
    renderDialog({
      product: makeProduct({ name: "Hammer Drill", id: "prod-1" }),
      onDeleted,
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });
    fireEvent.click(screen.getByTestId("delete-btn"));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith("prod-1");
    });
  });

  it("shows success toast after delete", async () => {
    mockDelete.mockResolvedValueOnce({ ok: true });
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });
    fireEvent.click(screen.getByTestId("delete-btn"));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  it("shows inline error and error toast when delete fails", async () => {
    mockDelete.mockResolvedValueOnce({
      ok: false,
      error: "You don't have permission to manage the library.",
    });
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });
    fireEvent.click(screen.getByTestId("delete-btn"));

    await waitFor(() => {
      expect(screen.getByText(/permission/i)).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("shows forbidden toast when result.code === 'Forbidden'", async () => {
    mockDelete.mockResolvedValueOnce({
      ok: false,
      error: "You don't have permission to manage the library.",
      code: "Forbidden",
    });
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hammer Drill" },
    });
    fireEvent.click(screen.getByTestId("delete-btn"));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("renders confirm label mentioning product name", () => {
    renderDialog({ product: makeProduct({ name: "Power Saw" }) });
    const content = screen.getByTestId("alert-dialog-content").textContent ?? "";
    expect(content).toContain("Power Saw");
  });

  it("does not call deleteProductAction when confirm text doesn't match", async () => {
    renderDialog({ product: makeProduct({ name: "Hammer Drill" }) });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "partial" },
    });
    // The button should be disabled, but simulate a click anyway
    fireEvent.click(screen.getByTestId("delete-btn"));

    // Should not have been called
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("shows purchase count = 0 in warning for a product with no purchases", () => {
    renderDialog({ product: makeProduct({ name: "New Item", purchase_count: 0 }) });
    const content = screen.getByTestId("alert-dialog-content").textContent ?? "";
    expect(content).toContain("0");
  });
});
