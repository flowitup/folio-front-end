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
  fetchProductImageUrl,
  type ProductListResult,
  type ProductDetailResult,
  type Supplier,
} from "@/lib/api/bibliotheque";
import { fetchMyCompanies } from "@/lib/api/companies/companies";

// ---------------------------------------------------------------------------
// Company resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the active company_id for the current user.
 * Mirrors the billing pages pattern: use the primary company (is_primary=true),
 * fall back to the first attached company when no primary is set.
 */
export async function getActiveCompanyIdAction(): Promise<string | null> {
  try {
    const companies = await fetchMyCompanies();
    if (companies.length === 0) return null;
    const primary = companies.find((c) => c.is_primary);
    return (primary ?? companies[0]).id;
  } catch {
    return null;
  }
}

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

export async function fetchProductImageUrlAction(
  productId: string
): Promise<{ ok: true; data: string | null } | { ok: false; error: string }> {
  try {
    const data = await fetchProductImageUrl(productId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
