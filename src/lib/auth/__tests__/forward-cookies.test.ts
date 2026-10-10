/**
 * Regression: the web session must survive a browser restart.
 *
 * The API used to send its auth cookies without a lifetime, so they were
 * re-set here as session cookies and closing the browser signed the user out
 * although the 7-day refresh token was still good. The API now sends each
 * cookie with its token's lifetime (Expires + Max-Age); the forwarder must
 * carry that Max-Age onto the cookies it sets in the browser.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const setCookie = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: setCookie }),
}));

const { setForwardedCookies, forwardedCookieOptions } = await import("../forward-cookies");
const { parseCookie } = await import("../cookie-parser");

// Exactly what Flask sends after a sign-in (values shortened).
const ACCESS =
  "access_token_cookie=eyJ.a.b; Expires=Fri, 09 Oct 2026 20:23:32 GMT; Max-Age=1799; HttpOnly; Path=/; SameSite=Lax";
const REFRESH =
  "refresh_token_cookie=eyJ.c.d; Expires=Fri, 16 Oct 2026 19:53:32 GMT; Max-Age=604799; HttpOnly; Path=/; SameSite=Lax";

beforeEach(() => {
  setCookie.mockReset();
});

describe("setForwardedCookies", () => {
  it("keeps each auth cookie's lifetime so it outlives the browser session", async () => {
    await setForwardedCookies([ACCESS, REFRESH]);

    expect(setCookie).toHaveBeenCalledWith(
      "access_token_cookie",
      "eyJ.a.b",
      expect.objectContaining({ httpOnly: true, maxAge: 1799, path: "/", sameSite: "lax" })
    );
    expect(setCookie).toHaveBeenCalledWith(
      "refresh_token_cookie",
      "eyJ.c.d",
      expect.objectContaining({ httpOnly: true, maxAge: 604799, path: "/", sameSite: "lax" })
    );
  });
});

describe("forwardedCookieOptions", () => {
  it("leaves out maxAge when the API sent a session cookie", () => {
    const options = forwardedCookieOptions(parseCookie("foo=bar; Path=/")!);
    expect(options).not.toHaveProperty("maxAge");
  });
});
