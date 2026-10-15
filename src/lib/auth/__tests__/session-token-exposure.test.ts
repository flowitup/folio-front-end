/**
 * The sign-in and invite-accept server actions hand their result to page
 * JavaScript. The session tokens belong in the HttpOnly cookies only, so
 * neither result may carry the access or refresh token from the API body.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { cookieSet } = vi.hoisted(() => ({ cookieSet: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, delete: () => undefined, set: cookieSet }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));

import { verifyOtpAction } from "@/lib/auth/otp-actions";
import { acceptInviteAction } from "@/lib/auth/actions";

const ACCESS = "fake-access-token-value";
const REFRESH = "fake-refresh-token-value";
const fetchMock = vi.fn();

function respond(body: unknown) {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "access_token_cookie=fake-cookie-value; Path=/; HttpOnly");
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200, headers }));
}

beforeEach(() => {
  fetchMock.mockReset();
  cookieSet.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyOtpAction", () => {
  it("returns the user but no token, and still forwards the cookies", async () => {
    respond({
      access_token: ACCESS,
      refresh_token: REFRESH,
      token_type: "Bearer",
      expires_in: 1800,
      user: { id: "u1", email: "a@example.test", permissions: [] },
    });

    const result = await verifyOtpAction("0612345678", "123456");

    expect(result).toEqual({
      success: true,
      user: { id: "u1", email: "a@example.test", permissions: [] },
    });
    expect(JSON.stringify(result)).not.toContain(ACCESS);
    expect(JSON.stringify(result)).not.toContain(REFRESH);
    expect(cookieSet).toHaveBeenCalledWith(
      "access_token_cookie",
      "fake-cookie-value",
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe("acceptInviteAction", () => {
  it("returns only the account fields, never the tokens, and still forwards the cookies", async () => {
    respond({
      access_token: ACCESS,
      refresh_token: REFRESH,
      user: { id: "u2", email: "b@example.test", display_name: "Bea" },
    });

    const result = await acceptInviteAction("tok", "Bea", "+33612345678", "123456");

    expect(result).toEqual({
      success: true,
      user: { id: "u2", email: "b@example.test", display_name: "Bea" },
    });
    expect(JSON.stringify(result)).not.toContain(ACCESS);
    expect(JSON.stringify(result)).not.toContain(REFRESH);
    expect(cookieSet).toHaveBeenCalledWith(
      "access_token_cookie",
      "fake-cookie-value",
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
