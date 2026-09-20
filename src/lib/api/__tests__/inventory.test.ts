/**
 * inventory.test.ts — Inventory API wrapper tests.
 *
 * Mocks global fetch + sessionAuthHeader; asserts URL, query params, method,
 * headers, body and response parsing for the warehouse and item wrappers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import {
  createInventoryItem,
  deleteWarehouse,
  listInventoryItems,
  listWarehouses,
  updateInventoryItem,
  type InventoryItem,
  type Warehouse,
} from "../inventory";

const BASE = "http://localhost:3001/api/v1";

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

const warehouse: Warehouse = {
  id: "w1",
  company_id: "co-1",
  name: "Kho Bình Thạnh",
  address: "12 NHC",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const drill: InventoryItem = {
  id: "i1",
  company_id: "co-1",
  name: "Máy khoan Bosch",
  category: "power_tool",
  reference: "SN-778",
  description: null,
  quantity: 3,
  condition: "working",
  location_type: "warehouse",
  warehouse_id: "w1",
  project_id: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("listWarehouses", () => {
  it("unwraps items and sends the company id and bearer", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ items: [warehouse] }));
    const result = await listWarehouses("co-1");
    expect(result).toEqual([warehouse]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/inventory/warehouses?company_id=co-1`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.cache).toBe("no-store");
  });
});

describe("listInventoryItems", () => {
  it("forwards only the filters that are set", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ items: [drill], total: 1 }));
    const result = await listInventoryItems("co-1", { condition: "damaged", q: "sn", location_type: undefined });
    expect(result.total).toBe(1);
    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(params.get("company_id")).toBe("co-1");
    expect(params.get("condition")).toBe("damaged");
    expect(params.get("q")).toBe("sn");
    expect(params.has("location_type")).toBe(false);
  });
});

describe("createInventoryItem", () => {
  it("posts the company id with the payload", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse(drill, 201));
    await createInventoryItem("co-1", {
      name: "Máy khoan Bosch",
      quantity: 3,
      condition: "working",
      location_type: "warehouse",
      warehouse_id: "w1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/inventory/items`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ company_id: "co-1", name: "Máy khoan Bosch", quantity: 3 });
  });
});

describe("updateInventoryItem", () => {
  it("patches the given id with the diff", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ ...drill, condition: "damaged" }));
    const result = await updateInventoryItem("i1", { condition: "damaged" });
    expect(result.condition).toBe("damaged");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/inventory/items/i1`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ condition: "damaged" });
  });
});

describe("deleteWarehouse", () => {
  it("resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteWarehouse("w1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("throws an error carrying status and body on a 409", async () => {
    fetchMock.mockResolvedValueOnce(makeJsonResponse({ error: "Conflict", message: "still holds rows" }, 409));
    await expect(deleteWarehouse("w1")).rejects.toMatchObject({
      status: 409,
      body: { error: "Conflict" },
    });
  });
});
