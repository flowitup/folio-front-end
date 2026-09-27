/**
 * product-edit-dialog.test.tsx — ProductEditDialog component tests.
 *
 * Tests: hydrates from product; submitting only-changed-field sends a diff
 * (NOT all fields); clearing an optional field sends null; no-change →
 * submit disabled; image replace calls uploadProductImageAction with force:true;
 * image failure is non-fatal. Image from a supplier link: Fetch replaces the
 * image at once (force:true) and shows it; bad links get a translated inline
 * reason; a link left unfetched is applied on Save; file and link replace each
 * other.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ---- Module mocks (hoisted) ----

vi.mock(
  "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions",
  () => ({
    updateProductAction: vi.fn(),
    uploadProductImageAction: vi.fn(),
    setProductImageFromUrlAction: vi.fn(),
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
  ProductImage: ({
    alt,
    hasImage,
    version,
  }: {
    alt: string;
    hasImage: boolean;
    version?: string;
  }) => (
    <div
      data-testid="product-image"
      data-alt={alt}
      data-has-image={String(hasImage)}
      data-version={version}
    />
  ),
}));

// ---- Imports after mocks ----

import {
  setProductImageFromUrlAction,
  updateProductAction,
  uploadProductImageAction,
} from "@/app/[locale]/(app)/bibliotheque/_actions/bibliotheque-actions";
import { toast } from "sonner";
import { ProductEditDialog } from "../product-edit-dialog";
import type { LibraryProduct } from "@/lib/api/bibliotheque";

const mockUpdate = vi.mocked(updateProductAction);
const mockUploadImage = vi.mocked(uploadProductImageAction);
const mockFromUrl = vi.mocked(setProductImageFromUrlAction);
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
    supplierName?: string;
    onImageChanged?: () => void;
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
      supplierName={props?.supplierName}
      onImageChanged={props?.onImageChanged}
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

  it("renders supplier NAME when supplierName prop is provided", () => {
    renderDialog(makeProduct({ supplier_id: "sup-1" }), { supplierName: "ACME Corp" });
    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
    expect(screen.queryByText("sup-1")).not.toBeInTheDocument();
  });

  it("falls back to supplier_id when supplierName prop is absent", () => {
    renderDialog(makeProduct({ supplier_id: "sup-uuid-1234" }));
    expect(screen.getByText("sup-uuid-1234")).toBeInTheDocument();
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

  it("shows forbidden toast when result.code === 'Forbidden'", async () => {
    mockUpdate.mockResolvedValueOnce({
      ok: false,
      error: "You don't have permission to manage the library.",
      code: "Forbidden",
    });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it("sets has_image: true on onUpdated when image upload succeeds", async () => {
    const base = makeProduct({ has_image: false });
    mockUpdate.mockResolvedValueOnce({ ok: true, data: base });
    mockUploadImage.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    const onUpdated = vi.fn();
    renderDialog(base, { onUpdated });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed Name" },
    });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ has_image: true })
      );
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

describe("ProductEditDialog — image from a supplier link", () => {
  beforeEach(() => vi.clearAllMocks());

  const LINK = "https://media.adeo.com/marketplace/photo.jpg";
  const linkInput = () => screen.getByLabelText(/supplier link/i) as HTMLInputElement;
  const typeLink = (value: string) => fireEvent.change(linkInput(), { target: { value } });
  const fetchButton = () => screen.getByRole("button", { name: /^fetch$/i });

  it("fetches the linked image at once with force:true and shows it", async () => {
    mockFromUrl.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    const onImageChanged = vi.fn();
    const onUpdated = vi.fn();
    renderDialog(makeProduct({ has_image: false }), { onImageChanged, onUpdated });

    const image = screen.getByTestId("product-image");
    expect(image).toHaveAttribute("data-has-image", "false");
    expect(image).toHaveAttribute("data-version", "2024-01-01T00:00:00Z");

    typeLink(LINK);
    fireEvent.click(fetchButton());

    await waitFor(() => {
      expect(mockFromUrl).toHaveBeenCalledWith("prod-1", LINK, { force: true });
      expect(mockToast.success).toHaveBeenCalledWith("Image updated.");
    });
    // New picture shown: flagged present and re-fetched under a new version.
    const refreshed = screen.getByTestId("product-image");
    expect(refreshed).toHaveAttribute("data-has-image", "true");
    expect(refreshed.getAttribute("data-version")).not.toBe("2024-01-01T00:00:00Z");
    expect(linkInput().value).toBe("");
    expect(onImageChanged).toHaveBeenCalledTimes(1);
    // Already saved server-side — the dialog stays open, nothing else to save.
    expect(onUpdated).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("Enter in the link field fetches instead of submitting the form", async () => {
    mockFromUrl.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    renderDialog();

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed Name" },
    });
    typeLink(LINK);
    fireEvent.keyDown(linkInput(), { key: "Enter" });

    await waitFor(() => {
      expect(mockFromUrl).toHaveBeenCalledWith("prod-1", LINK, { force: true });
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects a link that is not https without calling the server", () => {
    renderDialog();

    typeLink("http://media.adeo.com/photo.jpg");
    fireEvent.click(fetchButton());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a full image link starting with https://."
    );
    expect(mockFromUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["SsrfBlocked", "This site is not accepted. Use an image link from a supported supplier site."],
    ["UnsupportedMediaType", "This link does not point to a JPG, PNG or WebP image."],
    ["FileTooLarge", "This image is larger than 10 MB."],
    [undefined, "The image could not be downloaded from this link. Check it and try again."],
  ])("shows the translated reason when the server refuses (%s)", async (code, message) => {
    mockFromUrl.mockResolvedValueOnce({ ok: false, error: "refused", code });
    const onImageChanged = vi.fn();
    renderDialog(makeProduct(), { onImageChanged });

    typeLink(LINK);
    fireEvent.click(fetchButton());

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(message);
    });
    // The link stays so it can be corrected; nothing changed.
    expect(linkInput().value).toBe(LINK);
    expect(screen.getByTestId("product-image")).toHaveAttribute("data-has-image", "false");
    expect(onImageChanged).not.toHaveBeenCalled();
  });

  it("clears the error once the link is edited", async () => {
    mockFromUrl.mockResolvedValueOnce({ ok: false, error: "refused", code: "SsrfBlocked" });
    renderDialog();

    typeLink(LINK);
    fireEvent.click(fetchButton());
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    typeLink("https://media.adeo.com/other.jpg");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies a link left unfetched on Save, skipping PATCH when nothing else changed", async () => {
    mockFromUrl.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    const onUpdated = vi.fn();
    renderDialog(makeProduct({ has_image: false }), { onUpdated });

    typeLink(LINK);
    const save = screen.getByRole("button", { name: /save/i });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(mockFromUrl).toHaveBeenCalledWith("prod-1", LINK, { force: true });
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ has_image: true }));
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("a link that fails on Save is non-fatal — warning with the reason, still saved", async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: makeProduct({ name: "Changed" }) });
    mockFromUrl.mockResolvedValueOnce({ ok: false, error: "refused", code: "UnsupportedMediaType" });
    const onUpdated = vi.fn();
    renderDialog(makeProduct(), { onUpdated });

    fireEvent.change(screen.getByLabelText(/product name/i), {
      target: { value: "Changed" },
    });
    typeLink(LINK);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockToast.warning).toHaveBeenCalledWith(
        "Product saved, but the image could not be fetched from the link.",
        { description: "This link does not point to a JPG, PNG or WebP image." }
      );
      expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ has_image: false }));
    });
  });

  it("blocks Save on a pending link that is not https", () => {
    // (A malformed value never gets here: the url input's native validation
    // stops the submit first, in jsdom as in browsers.)
    renderDialog();

    typeLink("http://media.adeo.com/photo.jpg");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a full image link starting with https://."
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockFromUrl).not.toHaveBeenCalled();
  });

  it("typing a link drops a file chosen earlier; Save uses the link", async () => {
    mockFromUrl.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    renderDialog();

    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });
    typeLink(LINK);
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockFromUrl).toHaveBeenCalledWith("prod-1", LINK, { force: true });
    });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it("choosing a file clears a typed link; Save uploads the file", async () => {
    mockUploadImage.mockResolvedValueOnce({ ok: true, data: { image_storage_key: "k1" } });
    renderDialog();

    typeLink(LINK);
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/replace image/i), {
      target: { files: [file] },
    });
    expect(linkInput().value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUploadImage).toHaveBeenCalled();
    });
    expect(mockFromUrl).not.toHaveBeenCalled();
  });
});
