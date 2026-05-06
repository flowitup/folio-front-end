/**
 * attached-users.test.ts — API client smoke tests for list / boot.
 * Strategy: mock global fetch deterministically, assert URL / method / body.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// 'server-only' is aliased to a no-op stub in vitest.config.ts — no mock needed here.
vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: vi.fn().mockResolvedValue({ Authorization: "Bearer test-token" }),
}));
vi.mock("@/lib/config/env", () => ({
  env: { apiBaseUrl: "http://localhost:3001/api/v1" },
}));

import {
  fetchAttachedUsers,
  bootAttachedUser,
} from "@/lib/api/companies/attached-users";

const BASE = "http://localhost:3001/api/v1";

function makeJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_USER = {
  user_id: "user-1",
  email: "alice@example.com",
  display_name: "Alice",
  is_primary: true,
  attached_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// fetchAttachedUsers
// ---------------------------------------------------------------------------

describe("fetchAttachedUsers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs /companies/:id/attached-users and returns array", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(makeJsonResponse({ items: [SAMPLE_USER] }));

    const result = await fetchAttachedUsers("co-1");
    expect(result).toEqual([SAMPLE_USER]);

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1/attached-users`);
    expect(init.method).toBe("GET");
  });

  it("throws on 403 (non-admin)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(fetchAttachedUsers("co-1")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// bootAttachedUser
// ---------------------------------------------------------------------------

describe("bootAttachedUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("DELETEs /companies/:id/access/:userId", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 204 }));

    await bootAttachedUser("co-1", "user-2");

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toBe(`${BASE}/companies/co-1/access/user-2`);
    expect(init.method).toBe("DELETE");
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(bootAttachedUser("co-1", "ghost")).rejects.toThrow();
  });
});
