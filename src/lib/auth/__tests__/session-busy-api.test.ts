import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "access_token_cookie" ? { value: TOKEN } : undefined) }),
}));
vi.mock("@/lib/api/client-ip", () => ({ clientIpHeader: async () => ({}) }));
vi.mock("@/lib/config/env", () => ({ env: { apiBaseUrl: "http://api.test" } }));

// A JWT whose payload expires far in the future.
const TOKEN = `h.${btoa(JSON.stringify({ exp: 4102444800 }))}.s`;
const USER = { id: "u1", email: "", permissions: [], companies: [] };

import { getSession, clearSessionUserCache, SessionCheckUnavailableError } from "../session";

function answer(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("getSession when the API is busy", () => {
  beforeEach(() => {
    clearSessionUserCache();
    vi.restoreAllMocks();
  });

  it("treats a 401 as signed out", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(answer(401));
    await expect(getSession()).resolves.toBeNull();
  });

  it("keeps the last good user on a 429 instead of signing out", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(answer(200, USER));
    expect((await getSession())?.user.id).toBe("u1");
    fetchMock.mockResolvedValueOnce(answer(429, { error: "TooManyRequests" }));
    expect((await getSession())?.user.id).toBe("u1");
    fetchMock.mockResolvedValueOnce(answer(503));
    expect((await getSession())?.user.id).toBe("u1");
  });

  it("throws (error page with retry) on a 429 with no earlier answer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(answer(429));
    await expect(getSession()).rejects.toBeInstanceOf(SessionCheckUnavailableError);
  });

  it("drops the remembered user once the API says the token is invalid", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(answer(200, USER));
    await getSession();
    fetchMock.mockResolvedValueOnce(answer(401));
    await expect(getSession()).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(answer(429));
    await expect(getSession()).rejects.toBeInstanceOf(SessionCheckUnavailableError);
  });
});
