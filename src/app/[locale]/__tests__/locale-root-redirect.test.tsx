/**
 * Regression: visiting `/<locale>` (the locale root) must redirect by auth state.
 * - With session  → /<locale>/dashboard
 * - No session    → /<locale>/login
 *
 * Mirrors the next/navigation + getSession mocking pattern used in the
 * (app)/projects/[id]/notes actions tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(async () => "en"),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

const { redirect } = await import("next/navigation");
const { getLocale } = await import("next-intl/server");
const { getSession } = await import("@/lib/auth/session");
const LocaleRootPage = (await import("../page")).default;

const mockRedirect = vi.mocked(redirect);
const mockGetLocale = vi.mocked(getLocale);
const mockGetSession = vi.mocked(getSession);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetLocale.mockResolvedValue("en");
});

describe("locale root page redirect", () => {
  it("redirects authenticated user to /<locale>/dashboard", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "u1", email: "u@example.com", name: "U", roles: [], permissions: [] },
      accessToken: "tok",
      expiresAt: Date.now() + 60_000,
    } as never);

    await expect(LocaleRootPage()).rejects.toThrow("REDIRECT:/en/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/en/dashboard");
  });

  it("redirects unauthenticated user to /<locale>/login", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(LocaleRootPage()).rejects.toThrow("REDIRECT:/en/login");
    expect(mockRedirect).toHaveBeenCalledWith("/en/login");
  });

  it("respects the active locale (fr)", async () => {
    mockGetLocale.mockResolvedValue("fr");
    mockGetSession.mockResolvedValue(null);

    await expect(LocaleRootPage()).rejects.toThrow("REDIRECT:/fr/login");
    expect(mockRedirect).toHaveBeenCalledWith("/fr/login");
  });
});
