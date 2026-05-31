/**
 * projects-server.test.ts — server-only project API client smoke tests.
 * Strategy: mock global fetch deterministically, assert URL / method / auth header.
 *
 * Guards the regression where server components used the cookie-based client
 * fetch (no Bearer token on the server → 401 → null project → documents page
 * redirected the owner away). getProjectById must attach sessionAuthHeader.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 'server-only' is aliased to a no-op stub in vitest.config.ts — no mock needed here.
vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));
vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import { getProjectById, listProjects } from "@/lib/api/projects-server";

const BASE = "http://localhost:3001/api/v1";

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_PROJECT = {
  id: "proj-1",
  name: "Maison Lavandou",
  address: null,
  owner_id: "owner-1",
  user_count: 1,
  created_at: "2026-01-01T00:00:00Z",
};

describe("getProjectById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /projects/:id with the session Bearer token and returns the project", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(SAMPLE_PROJECT));

    const result = await getProjectById("proj-1");
    expect(result).toEqual(SAMPLE_PROJECT);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/projects/proj-1`);
    expect(init.method).toBe("GET");
    // The whole point of the server fetch: it must carry the auth header.
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });

  it("encodes the project id", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse(SAMPLE_PROJECT));
    await getProjectById("a/b c");
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe(`${BASE}/projects/a%2Fb%20c`);
  });

  it("throws on 401 (so callers can .catch to null)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(getProjectById("proj-1")).rejects.toThrow();
  });

  it("throws on 404", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(getProjectById("missing")).rejects.toThrow();
  });
});

describe("listProjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /projects with the session Bearer token and returns the array", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ projects: [SAMPLE_PROJECT] }));

    const result = await listProjects();
    expect(result).toEqual([SAMPLE_PROJECT]);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/projects`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
  });
});
