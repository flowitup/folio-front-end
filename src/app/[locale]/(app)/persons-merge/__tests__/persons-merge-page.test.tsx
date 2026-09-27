/** /persons-merge is a platform-ops tool: others get a 404, not a form that fails at the end. */
import { describe, it, expect, vi, beforeEach } from "vitest";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw NOT_FOUND;
  }),
  redirect: vi.fn(),
}));
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn().mockResolvedValue("fr"),
  getTranslations: vi.fn().mockResolvedValue((key: string) => `personsMerge.${key}`),
}));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/components/persons/person-merge-form", () => ({ PersonMergeForm: () => null }));

import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import PersonsMergePage from "../page";

beforeEach(() => vi.clearAllMocks());

describe("PersonsMergePage", () => {
  it("is not found for a company admin", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1", permissions: ["project:create", "company:manage"] },
    } as never);
    await expect(PersonsMergePage()).rejects.toBe(NOT_FOUND);
    expect(notFound).toHaveBeenCalled();
  });

  it("renders the translated tool for platform ops", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "ops", permissions: ["*:*"] } } as never);
    const el = (await PersonsMergePage()) as { props: { children: unknown[] } };
    expect(JSON.stringify(el)).toContain("personsMerge.title");
  });
});
