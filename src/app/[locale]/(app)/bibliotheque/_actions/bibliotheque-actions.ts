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
  setProductImageFromUrl,
  importPurchases,
  type ProductListResult,
  type ProductDetailResult,
  type Supplier,
  type LibraryProduct,
  type CreateProductPayload,
  type UpdateProductPayload,
  type ImportPurchasesPayload,
  type ImportPurchasesResult,
} from "@/lib/api/bibliotheque";
import { getTranslations } from "next-intl/server";

type HttpError = Error & { status?: number; body?: { error?: string } | null };

/**
 * A failed request as a message in the user's language — never the API
 * wrapper's "Failed to get product (HTTP 403)" or the backend's English text.
 */
async function errorText(err: unknown): Promise<string> {
  const t = await getTranslations("bibliotheque.errors");
  const status = (err as HttpError | null)?.status;
  if (status === 409) return t("duplicate");
  if (status === 403) return t("forbidden");
  if (status === 404) return t("notFound");
  if (status === 429) return t("rateLimited");
  if (status === 400 || status === 422) return t("invalidInput");
  return t("generic");
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
    return { ok: false, error: await errorText(err) };
  }
}

export async function listCategoriesAction(
  companyId: string
): Promise<{ ok: true; data: string[] } | { ok: false; error: string }> {
  try {
    const data = await listCategories(companyId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await errorText(err) };
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
    return { ok: false, error: await errorText(err) };
  }
}

export async function getProductAction(
  productId: string
): Promise<{ ok: true; data: ProductDetailResult } | { ok: false; error: string }> {
  try {
    const data = await getProduct(productId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: await errorText(err) };
  }
}

// ---------------------------------------------------------------------------
// Mutation actions
// ---------------------------------------------------------------------------

/** Classify a BE HTTP error into a translated message + optional raw code. */
async function classifyBackendError(err: unknown): Promise<{ error: string; code?: string }> {
  return { error: await errorText(err), code: (err as HttpError | null)?.body?.error };
}

export async function createProductAction(
  companyId: string,
  payload: CreateProductPayload
): Promise<{ ok: true; data: LibraryProduct } | { ok: false; error: string; code?: string }> {
  try {
    const data = await createProduct(companyId, payload);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, ...(await classifyBackendError(err)) };
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
    return { ok: false, ...(await classifyBackendError(err)) };
  }
}

export async function deleteProductAction(
  productId: string
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  try {
    await deleteProduct(productId);
    return { ok: true };
  } catch (err) {
    return { ok: false, ...(await classifyBackendError(err)) };
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
      return { ok: false, error: (await getTranslations("bibliotheque.errors"))("noImageFile") };
    }
    const data = await uploadProductImage(productId, file, opts);
    return { ok: true, data };
  } catch (err) {
    const httpErr = err as HttpError;
    const code = httpErr.body?.error;
    const t = await getTranslations("bibliotheque.errors");
    if (httpErr.status === 415) return { ok: false, error: t("imageUnsupported"), code };
    if (httpErr.status === 413) return { ok: false, error: t("imageTooLarge"), code };
    if (httpErr.status === 409) return { ok: false, error: t("imageAlreadySet"), code };
    return { ok: false, error: await errorText(err), code };
  }
}

/**
 * Ask the server to fetch a product image from a supplier link.
 * `code` carries the BE error code (SsrfBlocked, ValidationError,
 * UnsupportedMediaType, FileTooLarge, Forbidden, ...) so the UI can show a
 * reason of its own; `error` is already translated like its neighbours.
 */
export async function setProductImageFromUrlAction(
  productId: string,
  url: string,
  opts?: { force?: boolean }
): Promise<
  { ok: true; data: { image_storage_key: string } } | { ok: false; error: string; code?: string }
> {
  try {
    const data = await setProductImageFromUrl(productId, url, opts);
    return { ok: true, data };
  } catch (err) {
    const httpErr = err as HttpError;
    const code = httpErr.body?.error;
    const t = await getTranslations("bibliotheque.errors");
    if (httpErr.status === 400 || httpErr.status === 422) return { ok: false, error: t("imageLinkRefused"), code };
    if (httpErr.status === 415) return { ok: false, error: t("imageLinkNotImage"), code };
    if (httpErr.status === 413) return { ok: false, error: t("imageTooLarge"), code };
    return { ok: false, error: await errorText(err), code };
  }
}

export type ImportPurchasesErrorCode =
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "generic";

/**
 * Import one batch of purchase records (≤ 1000) into the company library.
 * `code` lets the import dialog tell apart a rate limit (retry after a pause),
 * a missing permission (stop) and a rejected batch (count its lines as errors).
 */
export async function importPurchasesAction(
  companyId: string,
  payload: ImportPurchasesPayload
): Promise<
  | { ok: true; data: ImportPurchasesResult }
  | { ok: false; error: string; code: ImportPurchasesErrorCode }
> {
  try {
    const data = await importPurchases(companyId, payload);
    return { ok: true, data };
  } catch (err) {
    const httpErr = err as Error & { status?: number; body?: { message?: string } | null };
    const message = httpErr.body?.message ?? (err instanceof Error ? err.message : "Unknown error");
    if (httpErr.status === 429) return { ok: false, error: message, code: "rate_limited" };
    if (httpErr.status === 401) return { ok: false, error: message, code: "unauthorized" };
    if (httpErr.status === 403) return { ok: false, error: message, code: "forbidden" };
    if (httpErr.status === 400 || httpErr.status === 422) {
      return { ok: false, error: message, code: "validation" };
    }
    return { ok: false, error: message, code: "generic" };
  }
}
