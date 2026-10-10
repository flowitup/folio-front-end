/**
 * A signed-out visit to an unprefixed URL keeps the visitor's language: the
 * locale redirect comes first (/projects -> /fr/projects), and only the
 * prefixed request is sent on to /fr/login. Building the login redirect from
 * the unprefixed path fell back to /en/login, and the English login page then
 * overwrote their NEXT_LOCALE cookie.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// next-intl's middleware does not load under Vitest (its ESM build imports
// "next/server" without an extension). Stand in for what it does with
// localePrefix "always": an unprefixed path is redirected to the saved or
// preferred locale, a prefixed one passes through.
vi.mock("next-intl/middleware", () => ({
  default: () => (req: NextRequest) => {
    const { pathname, search } = req.nextUrl;
    if (/^\/(en|fr|vi)(\/|$)/.test(pathname)) return NextResponse.next();
    const saved = req.cookies.get("NEXT_LOCALE")?.value;
    const preferred = req.headers.get("accept-language")?.slice(0, 2);
    const locale = [saved, preferred].find((l) => l && ["en", "fr", "vi"].includes(l)) ?? "en";
    return NextResponse.redirect(new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, req.url));
  },
}));

import { proxy } from "@/proxy";

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

function location(res: Response): string | null {
  const value = res.headers.get("location");
  if (!value) return null;
  const url = new URL(value, "http://localhost:3000");
  return decodeURIComponent(url.pathname + url.search);
}

afterEach(() => vi.unstubAllGlobals());

describe("proxy locale on unprefixed URLs", () => {
  it("sends a French browser to /fr/projects, not to /en/login", async () => {
    const res = await proxy(request("/projects", { "accept-language": "fr-FR,fr;q=0.9" }));
    expect(location(res)).toBe("/fr/projects");
  });

  it("follows the saved NEXT_LOCALE cookie and keeps the query", async () => {
    const res = await proxy(request("/billing/devis?status=draft", { cookie: "NEXT_LOCALE=vi" }));
    expect(location(res)).toBe("/vi/billing/devis?status=draft");
  });

  it("does not refresh the session before the locale redirect", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await proxy(request("/dashboard", { cookie: "NEXT_LOCALE=fr; refresh_token_cookie=r; csrf_refresh_token=c" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("then sends the prefixed page to the login page in that language", async () => {
    const res = await proxy(request("/fr/projects", { cookie: "NEXT_LOCALE=fr" }));
    expect(location(res)).toBe("/fr/login?callbackUrl=/fr/projects");
  });
});
