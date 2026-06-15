/**
 * Bibliothèque API wrappers — server-only.
 *
 * Typed wrappers for the company-scoped product library endpoints.
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client
 * components. Client components go through server actions or route handlers.
 *
 * Product image bytes are NOT served here: the ProductImage client component
 * fetches GET /products/<id>/image as a Blob with cookie auth (the API streams
 * the bytes), mirroring invoice attachment previews.
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

// ---------------------------------------------------------------------------
// Mutation payload types
// ---------------------------------------------------------------------------

export interface CreateProductPayload {
  name: string;
  supplier_id?: string;
  supplier_name?: string;
  supplier_website_url?: string | null;
  supplier_reference?: string | null;
  category?: string | null;
  description?: string | null;
  size?: string | null;
  product_url?: string | null;
}

export interface UpdateProductPayload {
  name?: string;
  category?: string | null;
  description?: string | null;
  size?: string | null;
  product_url?: string | null;
}

// ---------------------------------------------------------------------------
// Mutation wrappers
// ---------------------------------------------------------------------------

/**
 * Create a new library product for the company.
 * POST /bibliotheque/products → 201 LibraryProduct.
 * Exactly one of supplier_id or supplier_name must be set in payload.
 */
export async function createProduct(
  companyId: string,
  payload: CreateProductPayload
): Promise<LibraryProduct> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/bibliotheque/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ company_id: companyId, ...payload }),
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error creating product: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to create product");
  return response.json() as Promise<LibraryProduct>;
}

/**
 * Update (patch) a library product.
 * PATCH /bibliotheque/products/<id> → 200 LibraryProduct.
 * Only include keys that changed — omitted keys are left unchanged by the BE.
 */
export async function updateProduct(
  productId: string,
  payload: UpdateProductPayload
): Promise<LibraryProduct> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify(payload),
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error updating product: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to update product");
  return response.json() as Promise<LibraryProduct>;
}

/**
 * Delete a library product.
 * DELETE /bibliotheque/products/<id> → 204 no content.
 */
export async function deleteProduct(productId: string): Promise<void> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders },
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error deleting product: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to delete product");
}

/**
 * Upload or replace a product image (multipart, field: "image").
 * POST /bibliotheque/products/<id>/image → { image_storage_key }.
 * Use opts.force=true to overwrite an existing image.
 *
 * IMPORTANT: Do NOT set Content-Type — let fetch set the multipart boundary.
 * Allowed types: image/jpeg, image/png, image/webp. Max size: 10 MB.
 * Errors: 415 Unsupported Media Type, 413 Content Too Large.
 */
export async function uploadProductImage(
  productId: string,
  file: File,
  opts?: { force?: boolean }
): Promise<{ image_storage_key: string }> {
  const authHeaders = await sessionAuthHeader();
  const qs = opts?.force ? "?force=true" : "";
  const form = new FormData();
  form.append("image", file);
  let response: Response;
  try {
    response = await fetch(
      `${env.apiBaseUrl}/bibliotheque/products/${encodeURIComponent(productId)}/image${qs}`,
      {
        method: "POST",
        // Intentionally omit Content-Type — fetch sets multipart boundary automatically.
        headers: { ...authHeaders },
        body: form,
        cache: "no-store",
      }
    );
  } catch (err) {
    throw new Error(`Network error uploading product image: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, "Failed to upload product image");
  return response.json() as Promise<{ image_storage_key: string }>;
}

// Product image bytes are streamed from GET /bibliotheque/products/<id>/image
// and fetched client-side as a Blob by the ProductImage component (cookie auth),
// mirroring invoice attachment previews. No server-side wrapper needed here.
