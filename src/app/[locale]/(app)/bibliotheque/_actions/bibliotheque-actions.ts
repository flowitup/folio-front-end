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
  type ProductListResult,
  type ProductDetailResult,
  type Supplier,
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
