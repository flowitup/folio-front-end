/**
 * product-create-dialog.test.tsx — ProductCreateDialog component tests.
 *
 * Tests: renders fields; supplier mode toggle; submit calls createProductAction
 * with exactly-one-supplier payload; blank SKU omitted; success → onCreated called
 * + dialog closes; error → inline error shown. Validation: empty name blocks submit.
 * Image: when a file is chosen, uploadProductImageAction is called after create;
 * image-upload failure is non-fatal (product still created, warning toast).
 *
 * Uses fireEvent.change for inputs (avoids userEvent + fake-timer conflicts).
 * Mocks shadcn Select/Dialog so Radix portals don't interfere with jsdom.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---- Module mocks (hoisted) ----

vi.mock(
  "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions",
  () => ({
    createProductAction: vi.fn(),
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

// Mock shadcn Dialog to avoid Radix portal issues in jsdom
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

// Mock shadcn Select — renders a native <select> for testability
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

// ---- Imports after mocks ----

import {
  createProductAction,
  uploadProductImageAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { toast } from "sonner";
import { ProductCreateDialog } from "../product-create-dialog";
import type { Supplier, LibraryProduct } from "@/lib/api/bibliotheque";

const mockCreate = vi.mocked(createProductAction);
const mockUploadImage = vi.mocked(uploadProductImageAction);
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
};

// ---- Fixtures ----

function makeSupplier(overrides?: Partial<Supplier>): Supplier {
  return {
    id: "sup-1",
    company_id: "co-1",
    name: "ACME Corp",
    slug: "acme",
    website_url: null,
    logo_url: null,
    product_url_template: null,
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeProduct(overrides?: Partial<LibraryProduct>): LibraryProduct {
  return {
    id: "prod-new",
    company_id: "co-1",
    supplier_id: "sup-1",
    supplier_reference: "REF-001",
    name: "New Product",
    description: null,
    size: null,
    category: null,
    has_image: false,
    product_url: null,
    purchase_count: 0,
    total_quantity: "0",
    last_unit_price: null,
    first_purchased_at: null,
    last_purchased_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const SUPPLIERS = [makeSupplier()];

function renderDialog(
  props?: {
    open?: boolean;
    suppliers?: Supplier[];
    onOpenChange?: (o: boolean) => void;
    onCreated?: (p: LibraryProduct) => void;
  }
) {
  const onOpenChange = props?.onOpenChange ?? vi.fn();
  const onCreated = props?.onCreated ?? vi.fn();
  return render(
    <ProductCreateDialog
      open={props?.open ?? true}
      onOpenChange={onOpenChange}
      companyId="co-1"
      suppliers={props?.suppliers ?? SUPPLIERS}
      onCreated={onCreated}
    />
  );
}

// ---- Tests ----

describe("ProductCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not render when open=false", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders the create title heading", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Add product" })).toBeInTheDocument();
  });

  it("renders supplier mode toggle buttons", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /existing supplier/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new supplier/i })).toBeInTheDocument();
  });

  it("defaults to 'new' mode when suppliers list is empty", () => {
    renderDialog({ suppliers: [] });
    expect(screen.getByLabelText(/supplier name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/existing supplier/i)).not.toBeInTheDocument();
  });

  it("defaults to 'existing' mode when suppliers are available", () => {
    renderDialog({ suppliers: SUPPLIERS });
    // In existing mode, a select is rendered (not the supplier name input)
    const selects = screen.getAllByTestId("select");
    // First select is the supplier select
    expect(selects[0]).toBeInTheDocument();
  });

  it("switches to new-supplier mode when New button clicked", async () => {
    const user = userEvent.setup();
    renderDialog({ suppliers: SUPPLIERS });

    await user.click(screen.getByRole("button", { name: /new supplier/i }));

    expect(screen.getByLabelText(/supplier name/i)).toBeInTheDocument();
  });

  it("renders product name input", () => {
    renderDialog();
    expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
  });

  it("renders SKU / reference field with hint text", () => {
    renderDialog();
    expect(screen.getByLabelText(/sku \/ reference/i)).toBeInTheDocument();
    expect(screen.getByText(/leave blank to auto-generate/i)).toBeInTheDocument();
  });

  it("submit button is disabled when name is empty", () => {
    renderDialog();
    const submitBtn = screen.getByRole("button", { name: /add product/i });
    expect(submitBtn).toBeDisabled();
  });

  it("submit button is enabled when name is typed", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "My Product" },
    });
    const submitBtn = screen.getByRole("button", { name: /add product/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls createProductAction with supplier_id in existing mode", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    const onCreated = vi.fn();

    renderDialog({ onCreated });

    // Select a supplier
    const selects = screen.getAllByTestId("select");
    fireEvent.change(selects[0], { target: { value: "sup-1" } });

    // Enter product name
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "My Product" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        "co-1",
        expect.objectContaining({ name: "My Product", supplier_id: "sup-1" })
      );
    });
  });

  it("calls createProductAction with supplier_name in new mode", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    const user = userEvent.setup();
    const onCreated = vi.fn();

    renderDialog({ suppliers: [], onCreated });

    // Enter supplier name
    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "New Supplier Co" },
    });

    // Enter product name
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "My Product" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      const call = mockCreate.mock.calls[0];
      const payload = call[1];
      expect(payload.supplier_name).toBe("New Supplier Co");
      expect(payload.supplier_id).toBeUndefined();
    });
    // Suppress unused var warning
    void user;
  });

  it("omits supplier_id when in new-supplier mode", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      const payload = mockCreate.mock.calls[0][1];
      expect(payload.supplier_id).toBeUndefined();
    });
  });

  it("omits supplier_reference when SKU field is blank", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      const payload = mockCreate.mock.calls[0][1];
      expect(payload.supplier_reference).toBeUndefined();
    });
  });

  it("includes supplier_reference when SKU is filled", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.change(screen.getByLabelText(/sku \/ reference/i), {
      target: { value: "SKU-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      const payload = mockCreate.mock.calls[0][1];
      expect(payload.supplier_reference).toBe("SKU-123");
    });
  });

  it("calls onCreated with the returned product on success", async () => {
    const product = makeProduct({ name: "Created Product" });
    mockCreate.mockResolvedValueOnce({ ok: true, data: product });
    const onCreated = vi.fn();
    renderDialog({ suppliers: [], onCreated });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Created Product" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(product);
    });
  });

  it("shows success toast on create", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  it("shows inline error and error toast on create failure", async () => {
    mockCreate.mockResolvedValueOnce({ ok: false, error: "A product with this reference already exists." });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("calls uploadProductImageAction after successful create when image chosen", async () => {
    const product = makeProduct();
    mockCreate.mockResolvedValueOnce({ ok: true, data: product });
    mockUploadImage.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "key-1" } });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });

    // Simulate file selection
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/image/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalledWith(
        product.id,
        expect.any(FormData)
      );
    });
  });

  it("image upload failure is non-fatal — product is still created and warning toasted", async () => {
    const product = makeProduct();
    mockCreate.mockResolvedValueOnce({ ok: true, data: product });
    mockUploadImage.mockResolvedValueOnce({ ok: false, error: "Image too large (max 10 MB)." });
    const onCreated = vi.fn();
    renderDialog({ suppliers: [], onCreated });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/image/i), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      // Product was created
      expect(onCreated).toHaveBeenCalledWith(product);
      // Warning toast shown for image failure
      expect(mockToast.warning).toHaveBeenCalled();
      // Success toast still shown for product
      expect(mockToast.success).toHaveBeenCalled();
    });
  });

  it("does NOT call uploadProductImageAction when no image selected", async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: makeProduct() });
    renderDialog({ suppliers: [] });

    fireEvent.change(screen.getByLabelText(/supplier name/i), {
      target: { value: "Supplier X" },
    });
    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled();
    });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it("shows validation error when supplier not selected in existing mode", async () => {
    renderDialog({ suppliers: SUPPLIERS });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Product X" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add product/i }));

    await waitFor(() => {
      expect(screen.getByText(/please select or enter a supplier/i)).toBeInTheDocument();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
