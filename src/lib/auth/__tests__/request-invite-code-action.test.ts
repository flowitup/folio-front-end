/**
 * requestInviteCodeAction tells the number's hourly code cap (`OtpHourlyLimit`,
 * up to an hour) from the short resend gap, so the invitee is told how long to
 * wait instead of "wait a minute".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: async () => "en" }));

import { requestInviteCodeAction } from "@/lib/auth/actions";

const fetchMock = vi.fn();

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestInviteCodeAction", () => {
  it("reports the hourly cap with the minutes left", async () => {
    respond(429, { error: "OtpHourlyLimit", message: "Try again in 55 minutes." }, { "Retry-After": "3290" });
    await expect(requestInviteCodeAction("tok", "+33612345678")).resolves.toEqual({
      success: false,
      error: "hourly_limit",
      retryAfterMinutes: 55,
    });
  });

  it("keeps the short resend gap as throttled", async () => {
    respond(429, { error: "TooManyRequests" }, { "Retry-After": "60" });
    await expect(requestInviteCodeAction("tok", "+33612345678")).resolves.toEqual({
      success: false,
      error: "throttled",
    });
  });
});
