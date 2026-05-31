/**
 * bibliotheque.test.ts — Bibliotheque API wrapper tests.
 *
 * Tests server-only wrappers: listSuppliers, listCategories, listProducts, getProduct.
 * Strategy: mock global fetch + sessionAuthHeader deterministically, assert URL /
 * method / query params + auth header + response parsing.
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
  listSuppliers,
  listCategories,
  listProducts,
  getProduct,
  type Supplier,
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

// ---- Fixtures ----

const mockSupplier: Supplier = {
  id: "sup-1",
  company_id: "co-1",
  name: "ACME Corp",
  slug: "acme",
  website_url: "https://acme.com",
  logo_url: null,
  product_url_template: "https://acme.com/products/{ref}",
  created_at: "2024-01-01T00:00:00Z",
};

const mockProduct: LibraryProduct = {
  id: "prod-1",
  company_id: "co-1",
  supplier_id: "sup-1",
  supplier_reference: "REF-001",
  name: "Test Product",
  description: "A test product",
  size: "Large",
  category: "Electronics",
  has_image: true,
  product_url: "https://shop.com/prod",
  purchase_count: 5,
  total_quantity: "10",
  last_unit_price: "25.00",
  first_purchased_at: "2024-01-01T00:00:00Z",
  last_purchased_at: "2024-05-15T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// ---- Tests ----

describe("bibliotheque API wrappers", () => {
  beforeEach(() => vi.clearAllMocks());

  // ---- listSuppliers ----

  describe("listSuppliers", () => {
    it("GETs /bibliotheque/suppliers with company_id param", async () => {
      const response = makeJsonResponse({ items: [mockSupplier] });
      global.fetch = vi.fn().mockResolvedValueOnce(response);

      const result = await listSuppliers("co-1");

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];

      expect(url).toContain(`${BASE}/bibliotheque/suppliers`);
      expect(url).toContain("company_id=co-1");
      expect(init.method).toBe("GET");
      expect(result).toEqual([mockSupplier]);
    });

    it("includes auth header in request", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items: [] }));

      await listSuppliers("co-1");

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];

      expect(init.headers).toHaveProperty("Authorization", "Bearer test-token");
    });

    it("throws on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(403));

      await expect(listSuppliers("co-1")).rejects.toThrow("Failed to list suppliers");
    });

    it("throws on network error", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(listSuppliers("co-1")).rejects.toThrow(
        "Network error listing suppliers"
      );
    });
  });

  // ---- listCategories ----

  describe("listCategories", () => {
    it("GETs /bibliotheque/categories with company_id param", async () => {
      const response = makeJsonResponse({
        items: ["Electronics", "Tools", "Office"],
      });
      global.fetch = vi.fn().mockResolvedValueOnce(response);

      const result = await listCategories("co-1");

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];

      expect(url).toContain(`${BASE}/bibliotheque/categories`);
      expect(url).toContain("company_id=co-1");
      expect(init.method).toBe("GET");
      expect(result).toEqual(["Electronics", "Tools", "Office"]);
    });

    it("throws on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(500));

      await expect(listCategories("co-1")).rejects.toThrow(
        "Failed to list categories"
      );
    });
  });

  // ---- listProducts ----

  describe("listProducts", () => {
    it("GETs /bibliotheque/products with company_id", async () => {
      const response = makeJsonResponse({
        items: [mockProduct],
        total: 1,
        page: 1,
      });
      global.fetch = vi.fn().mockResolvedValueOnce(response);

      const result = await listProducts("co-1");

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];

      expect(url).toContain(`${BASE}/bibliotheque/products`);
      expect(url).toContain("company_id=co-1");
      expect(result.items).toEqual([mockProduct]);
      expect(result.total).toBe(1);
    });

    it("includes supplier filter in query params", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0, page: 1 }));

      await listProducts("co-1", { supplier: "sup-2" });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("supplier=sup-2");
    });

    it("includes category filter in query params", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0, page: 1 }));

      await listProducts("co-1", { category: "Electronics" });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("category=Electronics");
    });

    it("includes search query param", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0, page: 1 }));

      await listProducts("co-1", { q: "hammer" });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("q=hammer");
    });

    it("includes page param", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0, page: 2 }));

      await listProducts("co-1", { page: 2 });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("page=2");
    });

    it("includes all filters simultaneously", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0, page: 1 }));

      await listProducts("co-1", {
        supplier: "sup-2",
        category: "Tools",
        q: "drill",
        page: 3,
      });

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("supplier=sup-2");
      expect(url).toContain("category=Tools");
      expect(url).toContain("q=drill");
      expect(url).toContain("page=3");
    });

    it("throws on non-ok response", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(401));

      await expect(listProducts("co-1")).rejects.toThrow("Failed to list products");
    });
  });

  // ---- getProduct ----

  describe("getProduct", () => {
    it("GETs /bibliotheque/products/<id>", async () => {
      const purchases = [
        {
          product_id: "prod-1",
          source_document_ref: "INV-001",
          source_document_type: "ticket" as const,
          line_index: 0,
          purchased_at: "2024-05-15T10:00:00Z",
          quantity: "2",
          unit_price: "25.00",
        },
      ];
      const response = makeJsonResponse({
        product: mockProduct,
        purchases,
      });
      global.fetch = vi.fn().mockResolvedValueOnce(response);

      const result = await getProduct("prod-1");

      const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];

      expect(url).toBe(`${BASE}/bibliotheque/products/prod-1`);
      expect(init.method).toBe("GET");
      expect(result.product).toEqual(mockProduct);
      expect(result.purchases).toEqual(purchases);
    });

    it("encodes productId in URL", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ product: mockProduct, purchases: [] }));

      await getProduct("prod/with/slashes");

      const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("prod%2Fwith%2Fslashes");
    });

    it("includes auth header", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeJsonResponse({ product: mockProduct, purchases: [] }));

      await getProduct("prod-1");

      const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        RequestInit,
      ];

      expect(init.headers).toHaveProperty("Authorization", "Bearer test-token");
    });

    it("throws on 404 response", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeErrorResponse(404, { message: "not found" }));

      await expect(getProduct("missing")).rejects.toThrow("Failed to get product");
    });

    it("throws on network error", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(getProduct("prod-1")).rejects.toThrow(
        "Network error fetching product"
      );
    });

    it("returns purchase history in response", async () => {
      const purchase1 = {
        product_id: "prod-1",
        source_document_ref: "INV-001",
        source_document_type: "ticket" as const,
        line_index: 0,
        purchased_at: "2024-05-15T10:00:00Z",
        quantity: "2",
        unit_price: "25.00",
      };
      const purchase2 = {
        product_id: "prod-1",
        source_document_ref: "CMD-001",
        source_document_type: "commande" as const,
        line_index: 0,
        purchased_at: "2024-03-10T14:00:00Z",
        quantity: "5",
        unit_price: "20.00",
      };

      global.fetch = vi.fn().mockResolvedValueOnce(
        makeJsonResponse({
          product: mockProduct,
          purchases: [purchase1, purchase2],
        })
      );

      const result = await getProduct("prod-1");

      expect(result.purchases).toHaveLength(2);
      expect(result.purchases[0]).toEqual(purchase1);
      expect(result.purchases[1]).toEqual(purchase2);
    });

    it("returns empty purchases array when none exist", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        makeJsonResponse({
          product: mockProduct,
          purchases: [],
        })
      );

      const result = await getProduct("prod-1");

      expect(result.purchases).toEqual([]);
    });
  });

  // ---- HTTP error details ----

  describe("HTTP error handling", () => {
    it("includes status code in error", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(500));

      try {
        await listSuppliers("co-1");
      } catch (err) {
        const error = err as Error & { status?: number };
        expect(error.status).toBe(500);
      }
    });

    it("parses JSON error body when available", async () => {
      const errorBody = { error: "Unauthorized", message: "Invalid token" };
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(makeErrorResponse(401, errorBody));

      try {
        await listSuppliers("co-1");
      } catch (err) {
        const error = err as Error & { body?: Record<string, unknown> };
        expect(error.body).toEqual(errorBody);
      }
    });

    it("handles non-JSON error responses gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        })
      );

      try {
        await listSuppliers("co-1");
      } catch (err) {
        const error = err as Error & { body?: Record<string, unknown> };
        expect(error.body).toBeNull();
      }
    });
  });
});
