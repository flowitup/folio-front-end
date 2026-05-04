/**
 * Regression tests for F-2 — CSRF cookie forwarding on mutating requests.
 *
 * Pre-fix: the BE-issued `csrf_access_token` cookie was set but never read by
 * the FE; mutations relied solely on the Bearer header to suppress
 * Flask-JWT-Extended's CSRF check.
 * Post-fix: getCsrfToken() reads the cookie and getCsrfHeader() emits an
 * `X-CSRF-TOKEN` header on POST/PUT/PATCH/DELETE — defence-in-depth that
 * stays valid even if the auth layer ever falls back to cookie-only auth.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCsrfToken, getCsrfHeader, api } from "../http";

const COOKIE_NAME = "csrf_access_token";

function setCookie(value: string | null) {
  // jsdom's document.cookie supports a single-cookie set per assignment, and
  // expiring the cookie clears it. Both code paths exercise the same setter.
  if (value === null) {
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    return;
  }
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/`;
}

describe("getCsrfToken", () => {
  beforeEach(() => {
    setCookie(null);
  });

  it("returns null when the csrf cookie is absent", () => {
    expect(getCsrfToken()).toBeNull();
  });

  it("returns the cookie value when present", () => {
    setCookie("abc123token");
    expect(getCsrfToken()).toBe("abc123token");
  });

  it("URL-decodes the cookie value", () => {
    setCookie("a b/c+d");
    expect(getCsrfToken()).toBe("a b/c+d");
  });

  it("ignores other cookies that share a prefix", () => {
    document.cookie = "csrf_access_token_other=imposter; path=/";
    document.cookie = `${COOKIE_NAME}=real; path=/`;
    expect(getCsrfToken()).toBe("real");
  });
});

describe("getCsrfHeader", () => {
  beforeEach(() => {
    setCookie(null);
  });

  it("returns an empty object on safe (GET, HEAD, OPTIONS) verbs", () => {
    setCookie("real");
    expect(getCsrfHeader("GET")).toEqual({});
    expect(getCsrfHeader("HEAD")).toEqual({});
    expect(getCsrfHeader("OPTIONS")).toEqual({});
  });

  it("emits X-CSRF-TOKEN on POST/PUT/PATCH/DELETE", () => {
    setCookie("real");
    expect(getCsrfHeader("POST")).toEqual({ "X-CSRF-TOKEN": "real" });
    expect(getCsrfHeader("PUT")).toEqual({ "X-CSRF-TOKEN": "real" });
    expect(getCsrfHeader("PATCH")).toEqual({ "X-CSRF-TOKEN": "real" });
    expect(getCsrfHeader("DELETE")).toEqual({ "X-CSRF-TOKEN": "real" });
  });

  it("returns an empty object when the cookie is absent on a mutation", () => {
    expect(getCsrfHeader("POST")).toEqual({});
  });

  it("is case-insensitive on the verb", () => {
    setCookie("real");
    expect(getCsrfHeader("post")).toEqual({ "X-CSRF-TOKEN": "real" });
  });
});

describe("api mutations forward X-CSRF-TOKEN", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setCookie("token-from-cookie");
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    setCookie(null);
  });

  it("api.post forwards X-CSRF-TOKEN", async () => {
    await api.post("/anything", { a: 1 });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRF-TOKEN"]).toBe("token-from-cookie");
  });

  it("api.delete forwards X-CSRF-TOKEN", async () => {
    await api.delete("/anything");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRF-TOKEN"]).toBe("token-from-cookie");
  });

  it("api.get does NOT forward X-CSRF-TOKEN", async () => {
    await api.get("/anything");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-CSRF-TOKEN"]).toBeUndefined();
  });
});
