/**
 * companies.test.ts — API client smoke tests (mocked fetch).
 *
 * Tests: CRUD + set-primary + detach.
 * Strategy: mock global fetch deterministically, assert URL / method / body.
 *
 * These modules use "server-only" + sessionAuthHeader — both are mocked below.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Module mocks (must be hoisted before imports of the module under test)
// ---------------------------------------------------------------------------

// 'server-only' is aliased to a no-op stub in vitest.config.ts — no mock needed here.

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  fetchMyCompanies,
  fetchAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  setPrimaryCompany,
  detachCompany,
} from "@/lib/api/companies/companies";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeErrorResponse(status: number, body?: unknown): Response {
  return new Response(JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const BASE = "http://localhost:3001/api/v1";

// ---------------------------------------------------------------------------
// fetchMyCompanies
// ---------------------------------------------------------------------------

describe("fetchMyCompanies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /companies and returns items array", async () => {
    const items = [{ id: "co-1", legal_name: "ACME" }];
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items }));

    const result = await fetchMyCompanies();
    expect(result).toEqual(items);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies`);
    expect(init.method).toBe("GET");
  });

  it("flattens nested {access, company} items into flat MyCompany", async () => {
    const items = [
      {
        access: { is_primary: true, attached_at: "2024-01-15T10:00:00Z", role: "admin" },
        company: { id: "co-1", legal_name: "ACME Corp", address: "Paris", siret: "123456" },
      },
      {
        access: { is_primary: false, attached_at: "2024-02-20T14:30:00Z", role: "member" },
        company: { id: "co-2", legal_name: "XYZ Ltd", address: "Lyon", siret: "789012" },
      },
    ];
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items }));

    const result = await fetchMyCompanies();

    expect(result).toHaveLength(2);
    // First company should be flattened with is_primary=true + role
    expect(result[0]).toEqual({
      id: "co-1",
      legal_name: "ACME Corp",
      address: "Paris",
      siret: "123456",
      is_primary: true,
      attached_at: "2024-01-15T10:00:00Z",
      role: "admin",
    });
    // Second company should be flattened with is_primary=false + role
    expect(result[1]).toEqual({
      id: "co-2",
      legal_name: "XYZ Ltd",
      address: "Lyon",
      siret: "789012",
      is_primary: false,
      attached_at: "2024-02-20T14:30:00Z",
      role: "member",
    });
  });

  it("passes through already-flat MyCompany items unchanged", async () => {
    const items = [
      {
        id: "co-1",
        legal_name: "ACME Corp",
        address: "Paris",
        is_primary: true,
        attached_at: "2024-01-15T10:00:00Z",
      },
    ];
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items }));

    const result = await fetchMyCompanies();

    expect(result).toEqual(items);
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(401));
    await expect(fetchMyCompanies()).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// fetchAllCompanies
// ---------------------------------------------------------------------------

describe("fetchAllCompanies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes scope=all in query string", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0 }));

    await fetchAllCompanies();

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("scope=all");
  });

  it("passes limit and offset", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items: [], total: 0 }));

    await fetchAllCompanies({ limit: 10, offset: 20 });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=20");
  });
});

// ---------------------------------------------------------------------------
// createCompany
// ---------------------------------------------------------------------------

describe("createCompany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs to /companies with JSON body", async () => {
    const company = { id: "co-1", legal_name: "New Co", address: "Paris" };
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(company));

    const payload = { legal_name: "New Co", address: "Paris" };
    const result = await createCompany(payload);
    expect(result).toEqual(company);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject(payload);
  });

  it("throws on 403", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(403));
    await expect(createCompany({ legal_name: "X", address: "Y" })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// updateCompany
// ---------------------------------------------------------------------------

describe("updateCompany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PUTs to /companies/:id with partial payload", async () => {
    const updated = { id: "co-1", legal_name: "Updated Co", address: "Lyon" };
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(updated));

    const result = await updateCompany("co-1", { legal_name: "Updated Co" });
    expect(result).toEqual(updated);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toMatchObject({ legal_name: "Updated Co" });
  });
});

// ---------------------------------------------------------------------------
// deleteCompany
// ---------------------------------------------------------------------------

describe("deleteCompany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DELETEs /companies/:id", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteCompany("co-1");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1`);
    expect(init.method).toBe("DELETE");
  });

  it("throws on 404", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeErrorResponse(404, { message: "not found" }));
    await expect(deleteCompany("missing")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// setPrimaryCompany
// ---------------------------------------------------------------------------

describe("setPrimaryCompany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PUTs /users/me/primary-company with company_id body", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await setPrimaryCompany("co-2");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/users/me/primary-company`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ company_id: "co-2" });
  });
});

// ---------------------------------------------------------------------------
// detachCompany
// ---------------------------------------------------------------------------

describe("detachCompany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DELETEs /companies/:id/access", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await detachCompany("co-1");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1/access`);
    expect(init.method).toBe("DELETE");
  });
});
