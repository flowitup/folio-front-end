/**
 * inventory-mutations.test.ts — Server action tests for the inventory.
 *
 * Ok paths plus the friendly error mapping (409 / 403 / 404 / 422) with the
 * raw backend code passed through so the UI can pick a toast.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/inventory", () => ({
  listWarehouses: vi.fn(),
  listInventoryItems: vi.fn(),
  createWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
  deleteWarehouse: vi.fn(),
  createInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),
}));

import {
  createInventoryItemAction,
  deleteWarehouseAction,
  listInventoryItemsAction,
  updateInventoryItemAction,
} from "../inventory-actions";
import { createInventoryItem, deleteWarehouse, listInventoryItems, updateInventoryItem } from "@/lib/api/inventory";

const mockCreate = vi.mocked(createInventoryItem);
const mockUpdate = vi.mocked(updateInventoryItem);
const mockDeleteWarehouse = vi.mocked(deleteWarehouse);
const mockList = vi.mocked(listInventoryItems);

function makeHttpError(status: number, errorCode: string, message = "boom") {
  const err = new Error(`Request failed (HTTP ${status})`) as Error & {
    status: number;
    body: { error: string; message: string };
  };
  err.status = status;
  err.body = { error: errorCode, message };
  return err;
}

const drill = {
  id: "i1",
  company_id: "co-1",
  name: "Máy khoan Bosch",
  category: "power_tool",
  reference: null,
  description: null,
  quantity: 3,
  condition: "working" as const,
  location_type: "warehouse" as const,
  warehouse_id: "w1",
  project_id: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listInventoryItemsAction", () => {
  it("returns the list on success and the message on failure", async () => {
    mockList.mockResolvedValueOnce({ items: [drill], total: 1 });
    expect(await listInventoryItemsAction("co-1")).toEqual({ ok: true, data: { items: [drill], total: 1 } });
    mockList.mockRejectedValueOnce(new Error("Network error"));
    expect(await listInventoryItemsAction("co-1")).toEqual({ ok: false, error: "Network error" });
  });
});

describe("createInventoryItemAction", () => {
  it("passes the payload through", async () => {
    mockCreate.mockResolvedValueOnce(drill);
    const result = await createInventoryItemAction("co-1", {
      name: "Máy khoan Bosch",
      quantity: 3,
      condition: "working",
      location_type: "warehouse",
      warehouse_id: "w1",
    });
    expect(result).toEqual({ ok: true, data: drill });
    expect(mockCreate).toHaveBeenCalledWith("co-1", expect.objectContaining({ name: "Máy khoan Bosch" }));
  });

  it("maps 403 to a permission message with the code", async () => {
    mockCreate.mockRejectedValueOnce(makeHttpError(403, "Forbidden"));
    expect(await createInventoryItemAction("co-1", { name: "x", quantity: 1, condition: "working", location_type: "site", project_id: "p" })).toEqual({
      ok: false,
      error: "You don't have permission to manage the inventory.",
      code: "Forbidden",
    });
  });

  it("surfaces the backend message on 422", async () => {
    mockCreate.mockRejectedValueOnce(makeHttpError(422, "ValidationError", "Project p does not belong to company co-1."));
    const result = await createInventoryItemAction("co-1", { name: "x", quantity: 1, condition: "working", location_type: "site", project_id: "p" });
    expect(result).toEqual({ ok: false, error: "Project p does not belong to company co-1.", code: "ValidationError" });
  });
});

describe("updateInventoryItemAction", () => {
  it("maps 404", async () => {
    mockUpdate.mockRejectedValueOnce(makeHttpError(404, "NotFound"));
    expect(await updateInventoryItemAction("i1", { quantity: 2 })).toEqual({ ok: false, error: "Not found.", code: "NotFound" });
  });
});

describe("deleteWarehouseAction", () => {
  it("maps 409 to the blocked message", async () => {
    mockDeleteWarehouse.mockRejectedValueOnce(makeHttpError(409, "Conflict"));
    expect(await deleteWarehouseAction("w1")).toEqual({
      ok: false,
      error: "This warehouse still holds equipment. Move or remove it first.",
      code: "Conflict",
    });
  });

  it("returns ok with null data on success", async () => {
    mockDeleteWarehouse.mockResolvedValueOnce(undefined);
    expect(await deleteWarehouseAction("w1")).toEqual({ ok: true, data: null });
  });
});
