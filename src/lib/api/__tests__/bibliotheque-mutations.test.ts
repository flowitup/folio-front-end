/**
 * bibliotheque-mutations.test.ts — API wrapper tests for product mutations.
 *
 * Tests createProduct, updateProduct, deleteProduct, uploadProductImage:
 * correct method/URL/body/multipart, 201/200/204 handling, buildHttpError on !ok.
 * Mirrors existing bibliotheque.test.ts style (mock fetch + sessionAuthHeader).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module mocks (hoisted before imports) ----

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

// ---- Imports (after mocks) ----

import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  type LibraryProduct,
} from "../bibliotheque";

// ---- Helpers ----

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, body?: unknown): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const BASE = "http://localhost:3001/api/v1";

const mockProduct: LibraryProduct = {
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
};

// ---- Tests ----

describe("createProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to /bibliotheque/products with company_id and payload", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct, 201));

    const result = await createProduct("co-1", { name: "Test", supplier_id: "sup-1" });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${BASE}/bibliotheque/products`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      company_id: "co-1",
      name: "Test",
      supplier_id: "sup-1",
    });
    expect(result).toEqual(mockProduct);
  });

  it("includes auth header", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct, 201));

    await createProduct("co-1", { name: "Test", supplier_id: "sup-1" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toHaveProperty("Authorization", "Bearer test-token");
  });

  it("sets Content-Type application/json", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct, 201));

    await createProduct("co-1", { name: "Test", supplier_id: "sup-1" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("throws buildHttpError on 409 with status and body attached", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(409, { error: "CONFLICT" }));

    let caught: unknown;
    try {
      await createProduct("co-1", { name: "Test", supplier_id: "sup-1" });
    } catch (err) {
      caught = err;
    }

    const e = caught as Error & { status?: number; body?: { error?: string } | null };
    expect(e).toBeDefined();
    expect(e.message).toContain("Failed to create product");
    expect(e.status).toBe(409);
    expect(e.body?.error).toBe("CONFLICT");
  });

  it("throws buildHttpError on 403", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(403));

    await expect(createProduct("co-1", { name: "Test", supplier_id: "sup-1" }))
      .rejects.toThrow("Failed to create product (HTTP 403)");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Connection refused"));

    await expect(createProduct("co-1", { name: "Test", supplier_id: "sup-1" }))
      .rejects.toThrow("Network error creating product");
  });

  it("sends supplier_name when provided", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct, 201));

    await createProduct("co-1", { name: "Test", supplier_name: "New Supplier" });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.supplier_name).toBe("New Supplier");
    expect(body.supplier_id).toBeUndefined();
  });
});

describe("updateProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PATCHes /bibliotheque/products/<id> with diff payload", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct));

    const result = await updateProduct("prod-1", { name: "Updated", category: null });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];

    expect(url).toBe(`${BASE}/bibliotheque/products/prod-1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Updated", category: null });
    expect(result).toEqual(mockProduct);
  });

  it("encodes productId in URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct));

    await updateProduct("prod/special", { name: "X" });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("prod%2Fspecial");
  });

  it("throws buildHttpError on 404", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(404));

    await expect(updateProduct("missing", { name: "X" }))
      .rejects.toThrow("Failed to update product (HTTP 404)");
  });

  it("sends only provided fields (diff semantics)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(mockProduct));

    await updateProduct("prod-1", { description: null });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body)).toEqual(["description"]);
    expect(body.description).toBeNull();
  });
});

describe("deleteProduct", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DELETEs /bibliotheque/products/<id> and returns void on 204", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(deleteProduct("prod-1")).resolves.toBeUndefined();

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/bibliotheque/products/prod-1`);
    expect(init.method).toBe("DELETE");
  });

  it("encodes productId in URL", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteProduct("prod/slash");

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("prod%2Fslash");
  });

  it("includes auth header", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteProduct("prod-1");

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toHaveProperty("Authorization", "Bearer test-token");
  });

  it("throws buildHttpError on 404", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(404, { message: "Not found" }));

    await expect(deleteProduct("missing")).rejects.toThrow("Failed to delete product (HTTP 404)");
  });

  it("throws buildHttpError on 403", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(403));

    await expect(deleteProduct("prod-1")).rejects.toThrow("Failed to delete product (HTTP 403)");
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Timeout"));

    await expect(deleteProduct("prod-1")).rejects.toThrow("Network error deleting product");
  });
});

describe("uploadProductImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to /bibliotheque/products/<id>/image as multipart", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    const result = await uploadProductImage("prod-1", file);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/bibliotheque/products/prod-1/image`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(result).toEqual({ image_storage_key: "key-abc" });
  });

  it("does NOT set Content-Type (lets fetch set multipart boundary)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.png", { type: "image/png" });

    await uploadProductImage("prod-1", file);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("appends file under field name 'image' in FormData", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.png", { type: "image/png" });

    await uploadProductImage("prod-1", file);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = init.body as FormData;
    expect(body.get("image")).toBe(file);
  });

  it("adds ?force=true when opts.force is set", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    await uploadProductImage("prod-1", file, { force: true });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("?force=true");
  });

  it("does NOT add ?force when opts.force is false/undefined", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    await uploadProductImage("prod-1", file);

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).not.toContain("force");
  });

  it("includes auth header", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      makeJsonResponse({ image_storage_key: "key-abc" })
    );
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    await uploadProductImage("prod-1", file);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(init.headers).toHaveProperty("Authorization", "Bearer test-token");
  });

  it("throws buildHttpError on 415", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(415));
    const file = new File(["img"], "photo.gif", { type: "image/gif" });

    await expect(uploadProductImage("prod-1", file)).rejects.toThrow(
      "Failed to upload product image (HTTP 415)"
    );
  });

  it("throws buildHttpError on 413", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(413));
    const file = new File(["big"], "large.png", { type: "image/png" });

    await expect(uploadProductImage("prod-1", file)).rejects.toThrow(
      "Failed to upload product image (HTTP 413)"
    );
  });

  it("throws on network error", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network down"));
    const file = new File(["img"], "photo.jpg", { type: "image/jpeg" });

    await expect(uploadProductImage("prod-1", file)).rejects.toThrow(
      "Network error uploading product image"
    );
  });

  it("attaches status and body to thrown error", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(413, { error: "TOO_LARGE" }));
    const file = new File(["big"], "large.png", { type: "image/png" });

    try {
      await uploadProductImage("prod-1", file);
    } catch (err) {
      const e = err as Error & { status?: number; body?: { error?: string } | null };
      expect(e.status).toBe(413);
      expect(e.body?.error).toBe("TOO_LARGE");
    }
  });
});
