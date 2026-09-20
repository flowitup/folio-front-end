"use server";

/**
 * Inventory server actions — the client component's only way to the API.
 *
 * Every action returns a discriminated result rather than throwing, so the
 * client can show the message inline and pick a toast from `code`. No
 * revalidatePath: the page reloads its own lists (same as bibliotheque).
 */

import {
  createInventoryItem,
  createWarehouse,
  deleteInventoryItem,
  deleteWarehouse,
  listInventoryItems,
  listWarehouses,
  updateInventoryItem,
  updateWarehouse,
  type CreateInventoryItemPayload,
  type CreateWarehousePayload,
  type InventoryItem,
  type InventoryItemFilters,
  type InventoryListResult,
  type UpdateInventoryItemPayload,
  type UpdateWarehousePayload,
  type Warehouse,
} from "@/lib/api/inventory";

type Ok<T> = { ok: true; data: T };
type Fail = { ok: false; error: string; code?: string };

/** Classify a BE HTTP error into a friendly message + the raw error code. */
function classifyBackendError(err: unknown): Fail {
  if (!(err instanceof Error)) return { ok: false, error: "Unknown error" };
  const httpErr = err as Error & { status?: number; body?: { error?: string; message?: string } | null };
  const code = httpErr.body?.error;
  if (httpErr.status === 409)
    return { ok: false, error: "This warehouse still holds equipment. Move or remove it first.", code };
  if (httpErr.status === 403)
    return { ok: false, error: "You don't have permission to manage the inventory.", code };
  if (httpErr.status === 404) return { ok: false, error: "Not found.", code };
  if (httpErr.status === 422) return { ok: false, error: httpErr.body?.message ?? err.message, code };
  return { ok: false, error: err.message, code };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listWarehousesAction(companyId: string): Promise<Ok<Warehouse[]> | Fail> {
  try {
    return { ok: true, data: await listWarehouses(companyId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function listInventoryItemsAction(
  companyId: string,
  filters?: InventoryItemFilters
): Promise<Ok<InventoryListResult> | Fail> {
  try {
    return { ok: true, data: await listInventoryItems(companyId, filters) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Warehouse mutations
// ---------------------------------------------------------------------------

export async function createWarehouseAction(
  companyId: string,
  payload: CreateWarehousePayload
): Promise<Ok<Warehouse> | Fail> {
  try {
    return { ok: true, data: await createWarehouse(companyId, payload) };
  } catch (err) {
    return classifyBackendError(err);
  }
}

export async function updateWarehouseAction(
  warehouseId: string,
  payload: UpdateWarehousePayload
): Promise<Ok<Warehouse> | Fail> {
  try {
    return { ok: true, data: await updateWarehouse(warehouseId, payload) };
  } catch (err) {
    return classifyBackendError(err);
  }
}

export async function deleteWarehouseAction(warehouseId: string): Promise<Ok<null> | Fail> {
  try {
    await deleteWarehouse(warehouseId);
    return { ok: true, data: null };
  } catch (err) {
    return classifyBackendError(err);
  }
}

// ---------------------------------------------------------------------------
// Item mutations
// ---------------------------------------------------------------------------

export async function createInventoryItemAction(
  companyId: string,
  payload: CreateInventoryItemPayload
): Promise<Ok<InventoryItem> | Fail> {
  try {
    return { ok: true, data: await createInventoryItem(companyId, payload) };
  } catch (err) {
    return classifyBackendError(err);
  }
}

export async function updateInventoryItemAction(
  itemId: string,
  payload: UpdateInventoryItemPayload
): Promise<Ok<InventoryItem> | Fail> {
  try {
    return { ok: true, data: await updateInventoryItem(itemId, payload) };
  } catch (err) {
    return classifyBackendError(err);
  }
}

export async function deleteInventoryItemAction(itemId: string): Promise<Ok<null> | Fail> {
  try {
    await deleteInventoryItem(itemId);
    return { ok: true, data: null };
  } catch (err) {
    return classifyBackendError(err);
  }
}
