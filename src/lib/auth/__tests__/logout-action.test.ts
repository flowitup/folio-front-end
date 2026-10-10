/**
 * Signing out must revoke the session on the backend. The API enforces CSRF on
 * cookie-authenticated calls, so the server action authenticates with a Bearer
 * access token and sends the refresh token in the body, which is the path
 * that revokes both tokens.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const jar = new Map<string, string>();
const deleted: string[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    delete: (name: string) => {
      deleted.push(name);
      jar.delete(name);
    },
  }),
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;${url}` });
  },
}));

vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }));

import { logout } from "@/lib/auth/actions";

function jwt(expSecondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })
  ).toString("base64url");
  return `h.${payload}.s`;
}

const fetchMock = vi.fn();

beforeEach(() => {
  jar.clear();
  deleted.length = 0;
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("logout", () => {
  it("sends the access token as Bearer and the refresh token in the body", async () => {
    const access = jwt(600);
    jar.set("access_token_cookie", access);
    jar.set("refresh_token_cookie", "refresh-1");

    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(init.headers.Authorization).toBe(`Bearer ${access}`);
    expect(init.headers.Cookie).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ refresh_token: "refresh-1" });
    expect(deleted).toEqual(
      expect.arrayContaining(["access_token_cookie", "refresh_token_cookie"])
    );
  });

  it("still revokes the refresh token when the access token has expired", async () => {
    jar.set("access_token_cookie", jwt(-60));
    jar.set("refresh_token_cookie", "refresh-2");

    await expect(logout()).rejects.toThrow("NEXT_REDIRECT");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ refresh_token: "refresh-2" });
  });
});

describe("logout redirect", () => {
  it("lands on the locale-prefixed login page", async () => {
    await expect(logout()).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/fr/login" });
  });

  it("comes back to the invitation the user signed out to accept", async () => {
    await expect(logout("/fr/accept-invite/tok")).rejects.toMatchObject({
      digest: "NEXT_REDIRECT;/fr/accept-invite/tok",
    });
  });

  it.each(["https://evil.example/x", "//evil.example", "/\\evil.example"])(
    "ignores an off-site return path %j",
    async (returnTo) => {
      await expect(logout(returnTo)).rejects.toMatchObject({ digest: "NEXT_REDIRECT;/fr/login" });
    }
  );
});
