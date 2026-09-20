/**
 * Inventory API wrappers — server-only.
 *
 * Typed wrappers for the company-scoped equipment inventory endpoints
 * (`/inventory/warehouses`, `/inventory/items`): the tools and machines a
 * company owns, how many, whether each is working or damaged, and where it
 * is — a warehouse with its address or a site (a project).
 *
 * Uses sessionAuthHeader (next/headers) — must NOT be imported by client
 * components. Client components go through the `_actions/` server actions.
 */

import "server-only";

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

// ---------------------------------------------------------------------------
// Types — field names mirror the BE WarehouseResponse / InventoryItemResponse
// ---------------------------------------------------------------------------

export type InventoryCondition = "working" | "damaged";
export type InventoryLocationType = "warehouse" | "site";

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  reference: string | null;
  description: string | null;
  quantity: number;
  condition: InventoryCondition;
  location_type: InventoryLocationType;
  warehouse_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryListResult {
  items: InventoryItem[];
  total: number;
}

export interface CreateWarehousePayload {
  name: string;
  address?: string | null;
}
export type UpdateWarehousePayload = Partial<CreateWarehousePayload>;

export interface CreateInventoryItemPayload {
  name: string;
  category?: string | null;
  reference?: string | null;
  description?: string | null;
  quantity: number;
  condition: InventoryCondition;
  location_type: InventoryLocationType;
  warehouse_id?: string | null;
  project_id?: string | null;
}
export type UpdateInventoryItemPayload = Partial<CreateInventoryItemPayload>;

export interface InventoryItemFilters {
  location_type?: InventoryLocationType;
  warehouse_id?: string;
  project_id?: string;
  condition?: InventoryCondition;
  q?: string;
}

// ---------------------------------------------------------------------------
// Internal error helper — mirrors bibliotheque.ts shape exactly
// ---------------------------------------------------------------------------

async function buildHttpError(
  response: Response,
  prefix: string
): Promise<Error & { status: number; body: { error?: string; message?: string } | null }> {
  let body: { error?: string; message?: string } | null = null;
  try {
    body = (await response.json()) as { error?: string; message?: string };
  } catch {
    // non-JSON body — leave null
  }
  const err = new Error(`${prefix} (HTTP ${response.status})`) as Error & {
    status: number;
    body: { error?: string; message?: string } | null;
  };
  err.status = response.status;
  err.body = body;
  return err;
}

async function request<T>(
  path: string,
  init: RequestInit,
  prefix: string,
  options: { empty?: boolean } = {}
): Promise<T> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders, ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error while calling ${path}: ${String(err)}`);
  }
  if (!response.ok) throw await buildHttpError(response, prefix);
  if (options.empty || response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export async function listWarehouses(companyId: string): Promise<Warehouse[]> {
  const params = new URLSearchParams({ company_id: companyId });
  const data = await request<{ items: Warehouse[] }>(
    `/inventory/warehouses?${params.toString()}`,
    { method: "GET" },
    "Failed to list warehouses"
  );
  return data.items;
}

export async function createWarehouse(
  companyId: string,
  payload: CreateWarehousePayload
): Promise<Warehouse> {
  return request<Warehouse>(
    `/inventory/warehouses`,
    { method: "POST", body: JSON.stringify({ company_id: companyId, ...payload }) },
    "Failed to create warehouse"
  );
}

export async function updateWarehouse(
  warehouseId: string,
  payload: UpdateWarehousePayload
): Promise<Warehouse> {
  return request<Warehouse>(
    `/inventory/warehouses/${encodeURIComponent(warehouseId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Failed to update warehouse"
  );
}

export async function deleteWarehouse(warehouseId: string): Promise<void> {
  await request<void>(
    `/inventory/warehouses/${encodeURIComponent(warehouseId)}`,
    { method: "DELETE" },
    "Failed to delete warehouse",
    { empty: true }
  );
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export async function listInventoryItems(
  companyId: string,
  filters: InventoryItemFilters = {}
): Promise<InventoryListResult> {
  const params = new URLSearchParams({ company_id: companyId });
  if (filters.location_type) params.set("location_type", filters.location_type);
  if (filters.warehouse_id) params.set("warehouse_id", filters.warehouse_id);
  if (filters.project_id) params.set("project_id", filters.project_id);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.q) params.set("q", filters.q);
  return request<InventoryListResult>(
    `/inventory/items?${params.toString()}`,
    { method: "GET" },
    "Failed to list inventory items"
  );
}

export async function createInventoryItem(
  companyId: string,
  payload: CreateInventoryItemPayload
): Promise<InventoryItem> {
  return request<InventoryItem>(
    `/inventory/items`,
    { method: "POST", body: JSON.stringify({ company_id: companyId, ...payload }) },
    "Failed to create inventory item"
  );
}

export async function updateInventoryItem(
  itemId: string,
  payload: UpdateInventoryItemPayload
): Promise<InventoryItem> {
  return request<InventoryItem>(
    `/inventory/items/${encodeURIComponent(itemId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Failed to update inventory item"
  );
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  await request<void>(
    `/inventory/items/${encodeURIComponent(itemId)}`,
    { method: "DELETE" },
    "Failed to delete inventory item",
    { empty: true }
  );
}
