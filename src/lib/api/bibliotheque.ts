/**
 * Bibliothèque API wrappers — server-only.
 *
 * Typed wrappers for the company-scoped product library endpoints.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client
 * components. Client components go through server actions or route handlers.
 *
 * Image endpoint returns a presigned object-storage URL; callers use it
 * directly in <img> src — no blob fetch needed for product thumbnails.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---------------------------------------------------------------------------
// Types — field names mirror the BE LibraryProductResponse / SupplierResponse
// ---------------------------------------------------------------------------

export interface Supplier {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  website_url: string | null;
  logo_url: string | null;
  product_url_template: string | null;
  created_at: string;
}

export interface LibraryProduct {
  id: string;
  company_id: string;
  supplier_id: string;
  supplier_reference: string;
  name: string;
  description: string | null;
  size: string | null;
  category: string | null;
  has_image: boolean;
  product_url: string | null;
  purchase_count: number;
  total_quantity: string;
  last_unit_price: string | null;
  first_purchased_at: string | null;
  last_purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LibraryPurchase {
  product_id: string;
  source_document_ref: string;
  source_document_type: "ticket" | "commande";
  line_index: number;
  purchased_at: string;
  quantity: string;
  unit_price: string;
}

export interface ProductListResult {
  items: LibraryProduct[];
  total: number;
  page: number;
}

export interface ProductDetailResult {
  product: LibraryProduct;
  purchases: LibraryPurchase[];
}

// ---------------------------------------------------------------------------
// Internal error helper — mirrors notes.ts shape exactly
// ---------------------------------------------------------------------------

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // Non-JSON body — leave null.
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

// ---------------------------------------------------------------------------
// Wrappers
// ---------------------------------------------------------------------------

/**
 * List all suppliers for the company.
 */
export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams({ company_id: companyId });
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/suppliers?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing suppliers: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list suppliers");
  const data = (await response.json()) as { items: Supplier[] };
  return data.items;
}

/**
 * List distinct product categories for the company.
 */
export async function listCategories(companyId: string): Promise<string[]> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams({ company_id: companyId });
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/categories?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing categories: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list categories");
  const data = (await response.json()) as { items: string[] };
  return data.items;
}

/**
 * List products with optional filters.
 */
export async function listProducts(
  companyId: string,
  filters?: {
    supplier?: string;
    category?: string;
    q?: string;
    page?: number;
  }
): Promise<ProductListResult> {
  const authHeaders = await sessionAuthHeader();
  const params = new URLSearchParams({ company_id: companyId });
  if (filters?.supplier) params.set("supplier", filters.supplier);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.q) params.set("q", filters.q);
  if (filters?.page) params.set("page", String(filters.page));
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products?${params.toString()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error listing products: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to list products");
  return response.json() as Promise<ProductListResult>;
}

/**
 * Fetch a single product with its purchase history.
 */
export async function getProduct(productId: string): Promise<ProductDetailResult> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error fetching product: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to get product");
  return response.json() as Promise<ProductDetailResult>;
}

/**
 * Fetch the presigned image URL for a product.
 * Returns null when the product has no image (404) or on any non-auth error.
 */
export async function fetchProductImageUrl(productId: string): Promise<string | null> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}/image`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch {
    return null;
  }
  if (response.status === 404) return null;
  if (!response.ok) return null;
  const data = (await response.json()) as { url: string };
  return data.url;
}
