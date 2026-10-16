/**
 * Project pages (settings, analyses, members) treat only 403/404 as "no
 * access"; an outage must not bounce a user who has access to /projects.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("@/lib/api/projects-server", () => ({ getProjectById: vi.fn() }));

import { ApiError } from "@/lib/api/http";
import { getProjectById } from "@/lib/api/projects-server";
import { getAccessibleProject } from "../project-access";

describe("getAccessibleProject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the project", async () => {
    vi.mocked(getProjectById).mockResolvedValue({ id: "p" } as never);
    await expect(getAccessibleProject("p", "fr")).resolves.toEqual({ id: "p" });
  });

  it.each([403, 404])("shows the not-found page on %i", async (status) => {
    vi.mocked(getProjectById).mockRejectedValue(new ApiError("x", status));
    await expect(getAccessibleProject("p", "fr")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends an expired session to sign-in", async () => {
    vi.mocked(getProjectById).mockRejectedValue(new ApiError("x", 401));
    await expect(getAccessibleProject("p", "vi")).rejects.toThrow("NEXT_REDIRECT:/vi/login");
  });

  it("throws an outage to the error boundary instead of redirecting", async () => {
    vi.mocked(getProjectById).mockRejectedValue(new Error("Network error fetching project"));
    await expect(getAccessibleProject("p", "fr")).rejects.toThrow("Network error fetching project");
    vi.mocked(getProjectById).mockRejectedValue(new ApiError("x", 502));
    await expect(getAccessibleProject("p", "fr")).rejects.toBeInstanceOf(ApiError);
  });
});
