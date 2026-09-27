import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, notFound } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mockGetSession }));
vi.mock("next/navigation", () => ({
  notFound,
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async () => (key: string) => `personsMerge.${key}`,
}));
vi.mock("@/components/persons/person-merge-form", () => ({ PersonMergeForm: () => null }));

import PersonsMergePage from "../page";

beforeEach(() => vi.clearAllMocks());

describe("/persons-merge", () => {
  it("is a 404 for anyone but platform ops (the API refuses them)", async () => {
    mockGetSession.mockResolvedValue({ user: { permissions: ["project:read"] } });
    await expect(PersonsMergePage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders the translated page for platform ops", async () => {
    mockGetSession.mockResolvedValue({ user: { permissions: ["*:*"] } });
    const el = await PersonsMergePage();
    expect(JSON.stringify(el)).toContain("personsMerge.title");
    expect(notFound).not.toHaveBeenCalled();
  });
});
