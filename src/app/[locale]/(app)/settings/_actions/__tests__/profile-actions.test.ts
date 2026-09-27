/**
 * Verified phone-number change server actions (profile-actions.ts):
 * requestPhoneChangeCodeAction → POST /auth/me/phone/request-code,
 * confirmPhoneChangeAction    → POST /auth/me/phone/confirm.
 * French numbers are normalised before they leave the server, and each backend
 * status maps onto the error the dialog shows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/config/env", () => ({ env: { apiBaseUrl: "http://api.test/api/v1" } }));

const mockAuthHeader = vi.fn();
vi.mock("@/lib/api/auth-header", () => ({
  sessionAuthHeader: () => mockAuthHeader(),
}));

const mockSetForwardedCookies = vi.fn();
vi.mock("@/lib/auth/forward-cookies", () => ({
  setForwardedCookies: (headers: string[]) => mockSetForwardedCookies(headers),
}));

const { requestPhoneChangeCodeAction, confirmPhoneChangeAction } = await import("../profile-actions");

const fetchMock = vi.fn();

function respond(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mockAuthHeader.mockResolvedValue({ Authorization: "Bearer t" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPhoneChangeCodeAction", () => {
  it("posts the E.164 number and returns the code lifetime", async () => {
    respond(202, { expires_in: 300 });
    await expect(requestPhoneChangeCodeAction("06 98 76 54 32")).resolves.toEqual({
      success: true,
      expiresIn: 300,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/auth/me/phone/request-code");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer t");
    expect(JSON.parse(init.body)).toEqual({ phone: "+33698765432" });
  });

  it("refuses a foreign number without calling the backend", async () => {
    await expect(requestPhoneChangeCodeAction("+84912345678")).resolves.toEqual({
      success: false,
      error: "invalid_phone",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, { error: "PhoneUnchanged" }, "same_phone"],
    [400, { error: "ValidationError" }, "invalid_phone"],
    [409, {}, "phone_taken"],
    [429, {}, "throttled"],
    [503, {}, "sms_failed"],
    [500, {}, "unknown"],
  ])("maps %i %j to %s", async (status, body, error) => {
    respond(status, body);
    await expect(requestPhoneChangeCodeAction("0698765432")).resolves.toEqual({
      success: false,
      error,
    });
  });

  it("fails without a session", async () => {
    mockAuthHeader.mockResolvedValueOnce({});
    await expect(requestPhoneChangeCodeAction("0698765432")).resolves.toEqual({
      success: false,
      error: "unknown",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("confirmPhoneChangeAction", () => {
  it("posts phone + code and returns the updated user", async () => {
    const user = { id: "u1", email: "a@b.c", phone: "+33698765432", permissions: [] };
    respond(200, user);
    await expect(confirmPhoneChangeAction("0698765432", " 123456 ")).resolves.toEqual({
      success: true,
      user,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/api/v1/auth/me/phone/confirm");
    expect(JSON.parse(init.body)).toEqual({ phone: "+33698765432", code: "123456" });
  });

  it("replaces the session cookies with the fresh tokens and keeps the tokens from the browser", async () => {
    const user = { id: "u1", email: "a@b.c", phone: "+33698765432", permissions: [] };
    const headers = new Headers({ "Content-Type": "application/json" });
    headers.append("Set-Cookie", "access_token_cookie=new-access; HttpOnly; Path=/");
    headers.append("Set-Cookie", "refresh_token_cookie=new-refresh; HttpOnly; Path=/");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...user, access_token: "new-access", refresh_token: "new-refresh" }), {
        status: 200,
        headers,
      })
    );

    await expect(confirmPhoneChangeAction("0698765432", "123456")).resolves.toEqual({
      success: true,
      user,
    });
    expect(mockSetForwardedCookies).toHaveBeenCalledWith([
      "access_token_cookie=new-access; HttpOnly; Path=/",
      "refresh_token_cookie=new-refresh; HttpOnly; Path=/",
    ]);
  });

  it("refuses a malformed code without calling the backend", async () => {
    await expect(confirmPhoneChangeAction("0698765432", "12")).resolves.toEqual({
      success: false,
      error: "invalid_code",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, { error: "InvalidCode" }, "invalid_code"],
    [400, { error: "ValidationError" }, "invalid_phone"],
    [409, {}, "phone_taken"],
    [429, {}, "throttled"],
    [401, {}, "unknown"],
    [500, {}, "unknown"],
  ])("maps %i %j to %s", async (status, body, error) => {
    respond(status, body);
    mockSetForwardedCookies.mockClear();
    await expect(confirmPhoneChangeAction("0698765432", "123456")).resolves.toEqual({
      success: false,
      error,
    });
    expect(mockSetForwardedCookies).not.toHaveBeenCalled();
  });
});
