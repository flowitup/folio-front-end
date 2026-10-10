/**
 * Onboarding gate of the (app) section layouts: a signed-in user with no
 * company and no visible project goes to /onboarding from every section, not
 * only from /dashboard (a direct link or a sidebar click skipped it).
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

vi.mock("@/lib/api/projects-server", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/lib/api/companies/companies", () => ({
  fetchMyCompanies: vi.fn(async () => [{ id: "c1", is_primary: true }]),
}));

vi.mock("@/app/[locale]/(app)/bibliotheque/bibliotheque-page-client", () => ({
  BibliothequePageClient: () => null,
}));

vi.mock("@/app/[locale]/(app)/inventory/inventory-page-client", () => ({
  InventoryPageClient: () => null,
}));

const { redirect } = await import("next/navigation");
const { getSession } = await import("@/lib/auth/session");
const { listProjects } = await import("@/lib/api/projects-server");
const { redirectToOnboardingIfNeeded } = await import("../onboarding-redirect");

const mockRedirect = vi.mocked(redirect);
const mockGetSession = vi.mocked(getSession);
const { fetchMyCompanies } = await import("@/lib/api/companies/companies");
const mockListProjects = vi.mocked(listProjects);

function sessionWith(companies: unknown[], permissions: string[] = []) {
  return {
    user: { id: "u1", email: "u@example.com", name: "U", permissions, companies },
    accessToken: "tok",
    expiresAt: Date.now() + 60_000,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("redirectToOnboardingIfNeeded", () => {
  it("sends a user with no company and no project to onboarding", async () => {
    mockGetSession.mockResolvedValue(sessionWith([]));
    mockListProjects.mockResolvedValue([]);

    await expect(redirectToOnboardingIfNeeded("fr")).rejects.toThrow("REDIRECT:/fr/onboarding");
    expect(mockRedirect).toHaveBeenCalledWith("/fr/onboarding");
  });

  it("lets a company member through without listing projects", async () => {
    mockGetSession.mockResolvedValue(sessionWith([{ id: "c1", role: "member" }]));

    await expect(redirectToOnboardingIfNeeded("en")).resolves.toBeUndefined();
    expect(mockListProjects).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("lets platform ops through", async () => {
    mockGetSession.mockResolvedValue(sessionWith([], ["*:*"]));

    await expect(redirectToOnboardingIfNeeded("en")).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("lets a user with no company but a visible project through", async () => {
    mockGetSession.mockResolvedValue(sessionWith([]));
    mockListProjects.mockResolvedValue([{ id: "p1" }] as never);

    await expect(redirectToOnboardingIfNeeded("en")).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("fails open when the project list cannot be read", async () => {
    mockGetSession.mockResolvedValue(sessionWith([]));
    mockListProjects.mockRejectedValue(new Error("502"));

    await expect(redirectToOnboardingIfNeeded("en")).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("does nothing without a session (the (app) layout sends it to /login)", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(redirectToOnboardingIfNeeded("en")).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("every section runs the onboarding gate", () => {
  // Layouts wrap a whole section; the library and inventory have one page,
  // gated before its own company lookup.
  const sections = [
    ["dashboard", async () => (await import("@/app/[locale]/(app)/dashboard/layout")).default],
    ["projects", async () => (await import("@/app/[locale]/(app)/projects/layout")).default],
    ["bibliotheque", async () => (await import("@/app/[locale]/(app)/bibliotheque/page")).default],
    ["inventory", async () => (await import("@/app/[locale]/(app)/inventory/page")).default],
  ] as const;

  it.each(sections)("/%s sends a user with no company to onboarding", async (_name, load) => {
    mockGetSession.mockResolvedValue(sessionWith([]));
    mockListProjects.mockResolvedValue([]);
    const Section = (await load()) as (props: { children: string }) => Promise<unknown>;

    await expect(Section({ children: "page" })).rejects.toThrow("REDIRECT:/en/onboarding");
    expect(fetchMyCompanies).not.toHaveBeenCalled();
  });

  it.each(sections)("/%s renders for a company member", async (_name, load) => {
    mockGetSession.mockResolvedValue(sessionWith([{ id: "c1", role: "member" }]));
    const Section = (await load()) as (props: { children: string }) => Promise<unknown>;

    await expect(Section({ children: "page" })).resolves.toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
