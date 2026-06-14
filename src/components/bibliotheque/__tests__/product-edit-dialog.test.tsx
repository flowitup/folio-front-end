/**
 * product-edit-dialog.test.tsx — ProductEditDialog component tests.
 *
 * Tests: hydrates from product; submitting only-changed-field sends a diff
 * (NOT all fields); clearing an optional field sends null; no-change →
 * submit disabled; image replace calls uploadProductImageAction with force:true;
 * image failure is non-fatal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---- Module mocks (hoisted) ----

vi.mock(
  "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions",
  () => ({
    updateProductAction: vi.fn(),
    uploadProductImageAction: vi.fn(),
  })
);

vi.mock("next-intl", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const en = require("../../../messages/en.json") as Record<string, unknown>;
  function resolve(obj: Record<string, unknown>, path: string): string {
    return path.split(".").reduce<unknown>((acc, k) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[k];
      return undefined;
    }, obj) as string ?? path;
  }
  return {
    useTranslations: (ns: string) => (key: string) => resolve(en, `${ns}.${key}`),
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
    disabled,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

vi.mock("@/components/bibliotheque/product-image", () => ({
  ProductImage: ({ alt }: { alt: string }) => (
    <div data-testid="product-image" data-alt={alt} />
  ),
}));

// ---- Imports after mocks ----

import {
  updateProductAction,
  uploadProductImageAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { toast } from "sonner";
import { ProductEditDialog } from "../product-edit-dialog";
import type { LibraryProduct } from "@/lib/api/bibliotheque";

const mockUpdate = vi.mocked(updateProductAction);
const mockUploadImage = vi.mocked(uploadProductImageAction);
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
    name: "Original Name",
    description: "Original description",
    size: "Large",
    category: "cuisine",
    has_image: false,
    product_url: "https://example.com/prod",
    purchase_count: 2,
    total_quantity: "5",
    last_unit_price: "10.00",
    first_purchased_at: "2024-01-01T00:00:00Z",
    last_purchased_at: "2024-06-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDialog(
  product: LibraryProduct | null = makeProduct(),
  props?: {
    open?: boolean;
    onOpenChange?: (o: boolean) => void;
    onUpdated?: (p: LibraryProduct) => void;
  }
) {
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  const onUpdated = props?.onUpdated ?? vi.fn();
  return render(
    <ProductEditDialog
      product={product}
      open={props?.open ?? true}
      onOpenChange={onOpenChange}
      onUpdated={onUpdated}
    />
  );
}

// ---- Tests ----

describe("ProductEditDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders null when product is null", () => {
    const { container } = renderDialog(null);
    expect(container.firstChild).toBeNull();
  });

  it("does not render when open=false", () => {
    renderDialog(makeProduct(), { open: false });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders the edit title", () => {
    renderDialog();
    expect(screen.getByText("Edit product")).toBeInTheDocument();
  });

  it("hydrates name field from product", () => {
    renderDialog(makeProduct({ name: "Hammer Drill" }));
    const nameInput = screen.getByLabelText(/product name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Hammer Drill");
  });

  it("hydrates description field from product", () => {
    renderDialog(makeProduct({ description: "A very good drill" }));
    const descInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    expect(descInput.value).toBe("A very good drill");
  });

  it("hydrates size field from product", () => {
    renderDialog(makeProduct({ size: "XL" }));
    const sizeInput = screen.getByLabelText(/size/i) as HTMLInputElement;
    expect(sizeInput.value).toBe("XL");
  });

  it("hydrates product URL field from product", () => {
    renderDialog(makeProduct({ product_url: "https://shop.example.com/prod" }));
    const urlInput = screen.getByLabelText(/product url/i) as HTMLInputElement;
    expect(urlInput.value).toBe("https://shop.example.com/prod");
  });

  it("shows read-only supplier reference in context row", () => {
    renderDialog(makeProduct({ supplier_reference: "SKU-9999" }));
    expect(screen.getByText("SKU-9999")).toBeInTheDocument();
  });

  it("submit button is disabled when nothing has changed", () => {
    renderDialog();
    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it("submit enabled when name changes", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed Name" },
    });
    expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
  });

  it("sends only changed fields (diff payload) to updateProductAction", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct({ name: "New Name" }) });
    const onUpdated = vi.fn();
    renderDialog(makeProduct(), { onUpdated });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "New Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith("prod-1", { name: "New Name" });
    });
    // Verify only name was sent — description, size, etc. omitted
    const diff = mockUpdate.mock.calls[0][1];
    expect(Object.keys(diff)).toEqual(["name"]);
  });

  it("sends null for a cleared optional field", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog(makeProduct({ size: "Large" }));

    // Clear the size field
    fireEvent.change(screen.getByLabelText(/size/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const diff = mockUpdate.mock.calls[0][1];
      expect(diff.size).toBeNull();
    });
  });

  it("does NOT call updateProductAction when only image changed (skips PATCH)", async () => {
    mockUploadImage.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    const onUpdated = vi.fn();
    renderDialog(makeProduct(), { onUpdated });

    // Choose a file without changing any text fields
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalled();
    });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalled();
  });

  it("calls uploadProductImageAction with force:true on image replace", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    mockUploadImage.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed" },
    });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalledWith(
        "prod-1",
        expect.any(FormData),
        { force: true }
      );
    });
  });

  it("image upload failure is non-fatal — shows warning toast, still calls onUpdated", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    mockUploadImage.mockResolvedValueOnce({ ok: false, error: "Unsupported image type (use JPG/PNG/WebP)." });
    const onUpdated = vi.fn();
    renderDialog(makeProduct(), { onUpdated });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed Name" },
    });
    const file = new File(["img"], "bad.gif", { type: "image/gif" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalled();
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it("calls onUpdated with returned product on success", async () => {
    const updated = makeProduct({ name: "Updated Name" });
    mockUpdate.mockResolvedValueOnce({ ok: true, data: updated });
    const onUpdated = vi.fn();
    renderDialog(makeProduct(), { onUpdated });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Updated Name" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
  });

  it("shows inline error and error toast when update fails", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: false, error: "You don't have permission to manage the library." });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/permission/i)).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("shows success toast on update", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  it("shows product image component when product has no pending image replacement", () => {
    renderDialog(makeProduct({ has_image: true }));
    expect(screen.getByTestId("product-image")).toBeInTheDocument();
  });
});
