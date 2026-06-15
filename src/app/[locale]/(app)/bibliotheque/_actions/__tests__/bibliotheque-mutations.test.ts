/**
 * bibliotheque-mutations.test.ts — Server action tests for product mutations.
 *
 * Tests createProductAction, updateProductAction, deleteProductAction,
 * uploadProductImageAction: ok path + friendly error mapping (409/403/404/415/413).
 * Mocks the @/lib/api/bibliotheque module; does NOT call fetch directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (hoisted) ----

vi.mock("@/lib/api/bibliotheque", () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  uploadProductImage: vi.fn(),
}));

// ---- Imports after mocks ----

import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  uploadProductImageAction,
} from "../bibliotheque-actions";

import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from "@/lib/api/bibliotheque";

const mockCreateProduct = vi.mocked(createProduct);
const mockUpdateProduct = vi.mocked(updateProduct);
const mockDeleteProduct = vi.mocked(deleteProduct);
const mockUploadProductImage = vi.mocked(uploadProductImage);

// ---- Fixtures ----

function makeProduct(overrides?: Record<string, unknown>) {
  return {
    id: "prod-1",
    company_id: "co-1",
    supplier_id: "sup-1",
    supplier_reference: "REF-001",
    name: "Test Product",
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

function makeHttpError(status: number, errorCode?: string): Error & { status: number; body: { error?: string } | null } {
  const err = new Error(`Failed (HTTP ${status})`) as Error & { status: number; body: { error?: string } | null };
  err.status = status;
  err.body = errorCode ? { error: errorCode } : null;
  return err;
}

// ---- Tests ----

describe("createProductAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with data on success", async () => {
    const product = makeProduct();
    mockCreateProduct.mockResolvedValueOnce(product);

    const result = await createProductAction("co-1", { name: "Test", supplier_id: "sup-1" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(product);
  });

  it("passes companyId and payload to createProduct", async () => {
    mockCreateProduct.mockResolvedValueOnce(makeProduct());
    const payload = { name: "Test", supplier_id: "sup-1", category: "cuisine" };

    await createProductAction("co-1", payload);

    expect(mockCreateProduct).toHaveBeenCalledWith("co-1", payload);
  });

  it("maps 409 to friendly duplicate error", async () => {
    mockCreateProduct.mockRejectedValueOnce(makeHttpError(409, "CONFLICT"));

    const result = await createProductAction("co-1", { name: "Test", supplier_id: "sup-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("already exists");
      expect(result.code).toBe("CONFLICT");
    }
  });

  it("maps 403 to permission error", async () => {
    mockCreateProduct.mockRejectedValueOnce(makeHttpError(403));

    const result = await createProductAction("co-1", { name: "Test", supplier_id: "sup-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("permission");
  });

  it("maps 404 to not found error", async () => {
    mockCreateProduct.mockRejectedValueOnce(makeHttpError(404));

    const result = await createProductAction("co-1", { name: "Test", supplier_id: "sup-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Not found.");
  });

  it("returns raw message for unexpected errors", async () => {
    mockCreateProduct.mockRejectedValueOnce(new Error("Network timeout"));

    const result = await createProductAction("co-1", { name: "Test", supplier_id: "sup-1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Network timeout");
  });
});

describe("updateProductAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with updated product on success", async () => {
    const product = makeProduct({ name: "Updated" });
    mockUpdateProduct.mockResolvedValueOnce(product);

    const result = await updateProductAction("prod-1", { name: "Updated" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Updated");
  });

  it("passes productId and diff payload to updateProduct", async () => {
    mockUpdateProduct.mockResolvedValueOnce(makeProduct());
    const diff = { name: "New name", category: null };

    await updateProductAction("prod-1", diff);

    expect(mockUpdateProduct).toHaveBeenCalledWith("prod-1", diff);
  });

  it("maps 403 to permission error", async () => {
    mockUpdateProduct.mockRejectedValueOnce(makeHttpError(403));

    const result = await updateProductAction("prod-1", { name: "X" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("permission");
  });

  it("maps 409 to duplicate reference error", async () => {
    mockUpdateProduct.mockRejectedValueOnce(makeHttpError(409));

    const result = await updateProductAction("prod-1", { name: "X" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already exists");
  });
});

describe("deleteProductAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true on successful delete", async () => {
    mockDeleteProduct.mockResolvedValueOnce(undefined);

    const result = await deleteProductAction("prod-1");

    expect(result.ok).toBe(true);
  });

  it("passes productId to deleteProduct", async () => {
    mockDeleteProduct.mockResolvedValueOnce(undefined);

    await deleteProductAction("prod-1");

    expect(mockDeleteProduct).toHaveBeenCalledWith("prod-1");
  });

  it("maps 403 to permission error", async () => {
    mockDeleteProduct.mockRejectedValueOnce(makeHttpError(403));

    const result = await deleteProductAction("prod-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("permission");
  });

  it("maps 404 to not found error", async () => {
    mockDeleteProduct.mockRejectedValueOnce(makeHttpError(404));

    const result = await deleteProductAction("prod-1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Not found.");
  });
});

describe("uploadProductImageAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns ok:true with image_storage_key on success", async () => {
    mockUploadProductImage.mockResolvedValueOnce({ image_storage_key: "key-abc" });
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });
    const fd = new FormData();
    fd.append("image", file);

    const result = await uploadProductImageAction("prod-1", fd);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.image_storage_key).toBe("key-abc");
  });

  it("passes file and force option to uploadProductImage", async () => {
    mockUploadProductImage.mockResolvedValueOnce({ image_storage_key: "key-abc" });
    const file = new File(["img"], "photo.png", { type: "image/png" });
    const fd = new FormData();
    fd.append("image", file);

    await uploadProductImageAction("prod-1", fd, { force: true });

    expect(mockUploadProductImage).toHaveBeenCalledWith("prod-1", file, { force: true });
  });

  it("returns error when no file in formData", async () => {
    const fd = new FormData();

    const result = await uploadProductImageAction("prod-1", fd);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("No image file provided.");
  });

  it("maps 415 to unsupported type error", async () => {
    mockUploadProductImage.mockRejectedValueOnce(makeHttpError(415));
    const file = new File(["img"], "photo.gif", { type: "image/gif" });
    const fd = new FormData();
    fd.append("image", file);

    const result = await uploadProductImageAction("prod-1", fd);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unsupported image type");
  });

  it("maps 413 to file too large error", async () => {
    mockUploadProductImage.mockRejectedValueOnce(makeHttpError(413));
    const file = new File(["big"], "big.png", { type: "image/png" });
    const fd = new FormData();
    fd.append("image", file);

    const result = await uploadProductImageAction("prod-1", fd);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("too large");
  });

  it("maps 409 to image already set error", async () => {
    mockUploadProductImage.mockRejectedValueOnce(makeHttpError(409));
    const file = new File(["img"], "photo.png", { type: "image/png" });
    const fd = new FormData();
    fd.append("image", file);

    const result = await uploadProductImageAction("prod-1", fd);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Image already set.");
  });
});
