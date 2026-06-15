"use server";

/**
 * Bibliothèque server actions.
 *
 * Thin wrappers around the server-only bibliotheque API wrappers, callable
 * from client components. Each returns { ok: true, data } | { ok: false, error }.
 */

import {
  listProducts,
  listSuppliers,
  listCategories,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
  type ProductListResult,
  type ProductDetailResult,
  type Supplier,
  type LibraryProduct,
  type CreateProductPayload,
  type UpdateProductPayload,
} from "@/lib/api/bibliotheque";

// ---------------------------------------------------------------------------
// Library actions
// ---------------------------------------------------------------------------

export async function listSuppliersAction(
  companyId: string
): Promise<{ ok: true; data: Supplier[] } | { ok: false; error: string }> {
  try {
    const data = await listSuppliers(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function listCategoriesAction(
  companyId: string
): Promise<{ ok: true; data: string[] } | { ok: false; error: string }> {
  try {
    const data = await listCategories(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function listProductsAction(
  companyId: string,
  filters?: { supplier?: string; category?: string; q?: string; page?: number }
): Promise<{ ok: true; data: ProductListResult } | { ok: false; error: string }> {
  try {
    const data = await listProducts(companyId, filters);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getProductAction(
  productId: string
): Promise<{ ok: true; data: ProductDetailResult } | { ok: false; error: string }> {
  try {
    const data = await getProduct(productId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Mutation actions
// ---------------------------------------------------------------------------

/** Classify a BE HTTP error into a friendly message + optional raw code. */
function classifyBackendError(err: unknown): { error: string; code?: string } {
  if (!(err instanceof Error)) return { error: "Unknown error" };
  const httpErr = err as Error & { status?: number; body?: { error?: string } | null };
  const code = httpErr.body?.error;
  if (httpErr.status === 409) return { error: "A product with this reference already exists.", code };
  if (httpErr.status === 403) return { error: "You don't have permission to manage the library.", code };
  if (httpErr.status === 404) return { error: "Not found.", code };
  return { error: err.message, code };
}

export async function createProductAction(
  companyId: string,
  payload: CreateProductPayload
): Promise<{ ok: true; data: LibraryProduct } | { ok: false; error: string; code?: string }> {
  try {
    const data = await createProduct(companyId, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, ...classifyBackendError(err) };
  }
}

export async function updateProductAction(
  productId: string,
  payload: UpdateProductPayload
): Promise<{ ok: true; data: LibraryProduct } | { ok: false; error: string; code?: string }> {
  try {
    const data = await updateProduct(productId, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, ...classifyBackendError(err) };
  }
}

export async function deleteProductAction(
  productId: string
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  try {
    await deleteProduct(productId);
    return { ok: true };
  } catch (err) {
    return { ok: false, ...classifyBackendError(err) };
  }
}

export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
  opts?: { force?: boolean }
): Promise<
  { ok: true; data: { image_storage_key: string } } | { ok: false; error: string; code?: string }
> {
  try {
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return { ok: false, error: "No image file provided." };
    }
    const data = await uploadProductImage(productId, file, opts);
    return { ok: true, data };
  } catch (err) {
    const httpErr = err as Error & { status?: number; body?: { error?: string } | null };
    const code = httpErr.body?.error;
    if (httpErr.status === 415) return { ok: false, error: "Unsupported image type (use JPG/PNG/WebP).", code };
    if (httpErr.status === 413) return { ok: false, error: "Image too large (max 10 MB).", code };
    if (httpErr.status === 409) return { ok: false, error: "Image already set.", code };
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error", code };
  }
}
