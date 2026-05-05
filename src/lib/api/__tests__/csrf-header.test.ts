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
import { getCsrfToken, getCsrfHeader, getRefreshCsrfToken, api } from "../http";

const COOKIE_NAME = "csrf_access_token";
const REFRESH_COOKIE_NAME = "csrf_refresh_token";

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

/**
 * Regression: refresh path must send the refresh-token CSRF header.
 *
 * Pre-fix: refreshAccessToken() called POST /auth/refresh without any header.
 * In production (JWT_COOKIE_CSRF_PROTECT=True), Flask-JWT-Extended returns 401,
 * bricking every mutating call once the access token expires.
 * Post-fix: the refresh fetch reads csrf_refresh_token and sends X-CSRF-TOKEN.
 */
describe("getRefreshCsrfToken", () => {
  function setRefreshCookie(value: string | null) {
    if (value === null) {
      document.cookie = `${REFRESH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      return;
    }
    document.cookie = `${REFRESH_COOKIE_NAME}=${encodeURIComponent(value)}; path=/`;
  }

  beforeEach(() => {
    setRefreshCookie(null);
  });

  it("returns null when the refresh CSRF cookie is absent", () => {
    expect(getRefreshCsrfToken()).toBeNull();
  });

  it("returns the refresh CSRF cookie value when present", () => {
    setRefreshCookie("refresh-csrf-xyz");
    expect(getRefreshCsrfToken()).toBe("refresh-csrf-xyz");
  });

  it("does not confuse the refresh CSRF with the access CSRF", () => {
    document.cookie = "csrf_access_token=access-only; path=/";
    setRefreshCookie("refresh-only");
    expect(getRefreshCsrfToken()).toBe("refresh-only");
  });
});

describe("refresh-on-401 forwards refresh CSRF header", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    document.cookie = `${COOKIE_NAME}=access-csrf; path=/`;
    document.cookie = `${REFRESH_COOKIE_NAME}=refresh-csrf; path=/`;
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${REFRESH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });

  it("includes X-CSRF-TOKEN from csrf_refresh_token on the refresh fetch", async () => {
    let call = 0;
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      call += 1;
      const u = String(url);
      // 1st call = the original DELETE → 401 to trigger refresh
      // 2nd call = the refresh
      // 3rd call = the retried DELETE
      if (u.endsWith("/auth/refresh")) {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        expect(headers["X-CSRF-TOKEN"]).toBe("refresh-csrf");
        return new Response(JSON.stringify({ access_token: "new" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (call === 1) {
        return new Response("", { status: 401 });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    });

    await api.delete("/projects/p-1");
    // Three calls in total: original 401, refresh, retry.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
