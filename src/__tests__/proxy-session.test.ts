/**
 * The proxy renews an expired access token with the refresh cookie before it
 * treats anyone as signed out, and never bounces /login on a cookie alone:
 * - a 30-minute access token must not end a 7-day session on the next page load;
 * - an unexpired token the API refuses must not loop /login <-> /dashboard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// The locale middleware is not under test: stand in for it with a plain
// pass-through, as it returns for an already-prefixed path.
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}));

import { proxy } from "@/proxy";
import { applySessionCookies, refreshSession } from "@/lib/auth/proxy-session";

const API = "http://api.test/api/v1";

function jwt(expSecondsFromNow: number): string {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })
  ).toString("base64url");
  return `h.${payload}.s`;
}

function request(path: string, cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    headers: cookie ? { cookie, "x-forwarded-for": "203.0.113.7" } : {},
  });
}

const NEW_ACCESS = jwt(1800);
const refreshOk = () =>
  new Response(JSON.stringify({ access_token: NEW_ACCESS }), {
    status: 200,
    headers: [
      ["set-cookie", `access_token_cookie=${NEW_ACCESS}; HttpOnly; Path=/; SameSite=Lax`],
      ["set-cookie", "csrf_access_token=csrf-new; Path=/; SameSite=Lax"],
    ],
  });

const fetchMock = vi.fn();

beforeEach(() => {
  // jsdom defines window, so env.apiBaseUrl reads the public URL here.
  vi.stubEnv("API_INTERNAL_BASE_URL", API);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("refreshSession", () => {
  it("does not call the API without a refresh cookie", async () => {
    expect(await refreshSession(request("/en/projects", {}))).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the refresh cookie with its CSRF token and the caller's IP", async () => {
    fetchMock.mockResolvedValue(refreshOk());
    const cookies = await refreshSession(
      request("/en/projects", { refresh_token_cookie: "r", csrf_refresh_token: "c" })
    );
    expect(cookies.map((c) => c.name)).toEqual(["access_token_cookie", "csrf_access_token"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth/refresh`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Cookie: "refresh_token_cookie=r",
      "X-CSRF-TOKEN": "c",
      "X-Forwarded-For": "203.0.113.7",
    });
  });

  it("returns nothing when the API refuses the refresh token", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    expect(await refreshSession(request("/en/projects", { refresh_token_cookie: "r" }))).toEqual(
      []
    );
  });
});

describe("applySessionCookies", () => {
  it("merges the new cookie into an existing request-header override", () => {
    const req = request("/en/projects", { refresh_token_cookie: "r", access_token_cookie: "old" });
    const res = NextResponse.next();
    res.headers.set("x-middleware-override-headers", "x-next-intl-locale");
    res.headers.set("x-middleware-request-x-next-intl-locale", "en");
    applySessionCookies(req, res, [
      { name: "access_token_cookie", value: "new", httpOnly: true, secure: false },
    ]);
    expect(res.headers.get("x-middleware-override-headers")).toBe("x-next-intl-locale,cookie");
    expect(res.headers.get("x-middleware-request-cookie")).toBe(
      "refresh_token_cookie=r; access_token_cookie=new"
    );
    expect(res.cookies.get("access_token_cookie")?.value).toBe("new");
  });

  it("forwards every request header when no override exists yet", () => {
    const req = request("/en/projects", { refresh_token_cookie: "r" });
    const res = NextResponse.next();
    applySessionCookies(req, res, [
      { name: "access_token_cookie", value: "new", httpOnly: true, secure: false },
    ]);
    const keys = res.headers.get("x-middleware-override-headers")?.split(",");
    expect(keys).toEqual(expect.arrayContaining(["cookie", "x-forwarded-for"]));
    expect(res.headers.get("x-middleware-request-x-forwarded-for")).toBe("203.0.113.7");
  });
});

describe("proxy session handling", () => {
  it("renews an expired access token instead of sending the user to /login", async () => {
    fetchMock.mockResolvedValue(refreshOk());
    const res = await proxy(
      request("/en/projects", {
        access_token_cookie: jwt(-60),
        refresh_token_cookie: "r",
        csrf_refresh_token: "c",
      })
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get("access_token_cookie")?.value).toBe(NEW_ACCESS);
    expect(res.headers.get("x-middleware-request-cookie")).toContain(
      `access_token_cookie=${NEW_ACCESS}`
    );
  });

  it("sends the user to /login when the refresh token is refused too", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    const res = await proxy(
      request("/en/projects", { access_token_cookie: jwt(-60), refresh_token_cookie: "r" })
    );
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/en/login?callbackUrl=%2Fen%2Fprojects"
    );
  });

  it("keeps the deep link's query in callbackUrl", async () => {
    const res = await proxy(request("/en/projects/p1/invoices?invoice=abc", {}));
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/en/login?callbackUrl=%2Fen%2Fprojects%2Fp1%2Finvoices%3Finvoice%3Dabc"
    );
  });

  it("does not refresh while the access token is still valid", async () => {
    const res = await proxy(
      request("/en/projects", { access_token_cookie: jwt(600), refresh_token_cookie: "r" })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBeNull();
  });

  it("hands the requested page to the render, for the layout's own redirect to /login", async () => {
    // An unexpired but revoked token passes the proxy; the (app) layout then
    // redirects and needs the page to keep it as callbackUrl.
    const req = request("/fr/projects?x=1", { access_token_cookie: jwt(600) });
    req.headers.set("x-folio-path", "/spoofed");
    const res = await proxy(req);
    expect(res.headers.get("x-middleware-request-x-folio-path")).toBe("/fr/projects?x=1");
    expect(res.headers.get("x-middleware-override-headers")?.split(",")).toEqual(
      expect.arrayContaining(["x-folio-path", "cookie"])
    );
  });

  it("does not forward the path on public pages", async () => {
    const res = await proxy(request("/en/login", {}));
    expect(res.headers.get("x-middleware-request-x-folio-path")).toBeNull();
  });

  it("never redirects /login on an unexpired cookie the API may refuse", async () => {
    const res = await proxy(request("/en/login", { access_token_cookie: jwt(600) }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});
