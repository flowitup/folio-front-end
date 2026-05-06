/**
 * Regression: parseCookie must preserve HttpOnly correctly so that the FE
 * forwarder doesn't blanket-stamp CSRF cookies as HttpOnly.
 *
 * Pre-fix: cookies were split on ';' and only name/value kept; the forwarder
 * then re-set every cookie with httpOnly=true, hiding csrf_access_token /
 * csrf_refresh_token from JS. Result: FE could never send X-CSRF-TOKEN, and
 * every mutation 401'd in production (JWT_COOKIE_CSRF_PROTECT=True).
 * Post-fix: parseCookie returns the original HttpOnly flag plus Max-Age,
 * SameSite and Path; the forwarder applies them as-is.
 */
import { describe, it, expect } from "vitest";
import { parseCookie } from "../cookie-parser";

describe("parseCookie", () => {
  it("returns null for malformed input", () => {
    expect(parseCookie("")).toBeNull();
    expect(parseCookie("noequals")).toBeNull();
    expect(parseCookie("=novalue")).toBeNull();
    expect(parseCookie("noname=")).toBeNull();
  });

  it("extracts name + value from a minimal cookie", () => {
    const c = parseCookie("foo=bar");
    expect(c).toEqual({ name: "foo", value: "bar", httpOnly: false });
  });

  it("preserves '=' inside the value", () => {
    const c = parseCookie("token=abc=def==; Path=/");
    expect(c?.value).toBe("abc=def==");
  });

  it("flags HttpOnly when present", () => {
    const c = parseCookie(
      "access_token_cookie=eyJ.X.Y; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=1800",
    );
    expect(c).toMatchObject({
      name: "access_token_cookie",
      httpOnly: true,
      maxAge: 1800,
      sameSite: "strict",
      path: "/",
    });
  });

  it("does NOT flag HttpOnly when absent — critical for CSRF cookies", () => {
    // Flask-JWT-Extended sets csrf_access_token without HttpOnly so JS can read it.
    const c = parseCookie(
      "csrf_access_token=abc123; Secure; Path=/; SameSite=Strict; Max-Age=1800",
    );
    expect(c?.httpOnly).toBe(false);
    expect(c?.name).toBe("csrf_access_token");
    expect(c?.maxAge).toBe(1800);
  });

  it("parses csrf_refresh_token attributes (longer Max-Age)", () => {
    const c = parseCookie(
      "csrf_refresh_token=def456; Secure; Path=/; SameSite=Strict; Max-Age=604800",
    );
    expect(c).toMatchObject({
      name: "csrf_refresh_token",
      httpOnly: false,
      maxAge: 604800,
      sameSite: "strict",
      path: "/",
    });
  });

  it("normalizes SameSite case", () => {
    expect(parseCookie("foo=bar; SameSite=Lax")?.sameSite).toBe("lax");
    expect(parseCookie("foo=bar; SameSite=STRICT")?.sameSite).toBe("strict");
    expect(parseCookie("foo=bar; SameSite=None")?.sameSite).toBe("none");
  });

  it("ignores unknown attributes", () => {
    const c = parseCookie("foo=bar; Domain=example.com; Whatever=1; HttpOnly");
    expect(c).toEqual({ name: "foo", value: "bar", httpOnly: true });
  });

  it("treats attribute keys as case-insensitive", () => {
    const c = parseCookie("foo=bar; httponly; max-age=10; PATH=/x");
    expect(c).toMatchObject({ httpOnly: true, maxAge: 10, path: "/x" });
  });
});
