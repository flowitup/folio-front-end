/**
 * Labor-roles API client against the backend contract (labor_role_routes.py):
 * GET/POST /labor/roles take an optional ?company_id=, PATCH and DELETE go to
 * /labor/roles/<id>, PATCH sends only the given fields, DELETE answers 204
 * with no body, and a refusal keeps the status and the backend's JSON.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));

vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import {
  createLaborRole,
  deleteLaborRole,
  fetchLaborRoles,
  updateLaborRole,
} from "@/lib/api/labor-roles";

const BASE = "http://localhost:3001/api/v1";
const COMPANY = "11111111-1111-1111-1111-111111111111";
const ROLE = {
  id: "r1",
  name: "Chef d'équipe",
  color: "#0EA5E9",
  created_at: "2026-01-01T00:00:00Z",
  slug: null,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("labor-roles API client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("lists the primary company's roles without a company_id", async () => {
    fetchMock.mockResolvedValue(json({ roles: [ROLE], palette: ["#0EA5E9"] }));

    await expect(fetchLaborRoles()).resolves.toEqual({ roles: [ROLE], palette: ["#0EA5E9"] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/labor/roles`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("scopes list and create to the given company", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ roles: [], palette: [] }))
      .mockResolvedValueOnce(json(ROLE, 201));

    await fetchLaborRoles(COMPANY);
    await createLaborRole({ name: "Chef d'équipe", color: "#0EA5E9" }, COMPANY);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/labor/roles?company_id=${COMPANY}`);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe(`${BASE}/labor/roles?company_id=${COMPANY}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "Chef d'équipe", color: "#0EA5E9" });
  });

  it("PATCHes /labor/roles/<id> with only the fields given", async () => {
    fetchMock.mockResolvedValue(json({ ...ROLE, color: "#10B981" }));

    const role = await updateLaborRole("r1", { color: "#10B981" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/labor/roles/r1`);
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ color: "#10B981" });
    expect(role.color).toBe("#10B981");
  });

  it("DELETEs /labor/roles/<id> and accepts the empty 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteLaborRole("r1")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/labor/roles/r1`);
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });

  it("encodes the role id into the path", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await deleteLaborRole("a/b");

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/labor/roles/a%2Fb`);
  });

  it("throws the status and the backend's JSON on a refusal", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "Forbidden", message: "Company admin or manager permission required" }, 403)
    );

    await expect(updateLaborRole("r1", { name: "X" })).rejects.toMatchObject({
      status: 403,
      body: { error: "Forbidden", message: "Company admin or manager permission required" },
    });
  });

  it("throws a 404 with no JSON body as-is", async () => {
    fetchMock.mockResolvedValue(new Response("Not Found", { status: 404 }));

    await expect(deleteLaborRole("r1")).rejects.toMatchObject({ status: 404, body: null });
  });
});
