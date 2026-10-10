/**
 * Project layout access gate: every /projects/<id>/... tab shows the same
 * "not found" page when the API refuses the project (403/404), instead of an
 * empty notebook, an empty board with "+" buttons or a new-expense form. Other
 * failures (session expired, outage) are left to the page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/http";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw NOT_FOUND;
  }),
}));
vi.mock("@/lib/api/projects-server", () => ({ getProjectById: vi.fn() }));

import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/api/projects-server";
import ProjectLayout from "../layout";

const PID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ id: PID });
const child = <p>tab</p>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProjectLayout", () => {
  it.each([403, 404])("shows the not-found page when the API answers %s", async (status) => {
    vi.mocked(getProjectById).mockRejectedValue(new ApiError(`HTTP ${status}`, status));
    await expect(ProjectLayout({ children: child, params })).rejects.toBe(NOT_FOUND);
    expect(getProjectById).toHaveBeenCalledWith(PID);
  });

  it("renders the tab for a project the caller can open", async () => {
    vi.mocked(getProjectById).mockResolvedValue({ id: PID } as never);
    const el = await ProjectLayout({ children: child, params });
    expect((el as { props: { children: unknown } }).props.children).toBe(child);
    expect(notFound).not.toHaveBeenCalled();
  });

  it.each([
    ["an expired session", new ApiError("HTTP 401", 401)],
    ["a server error", new ApiError("HTTP 500", 500)],
    ["a network failure", new Error("Network error fetching project")],
  ])("leaves %s to the page", async (_label, err) => {
    vi.mocked(getProjectById).mockRejectedValue(err);
    await ProjectLayout({ children: child, params });
    expect(notFound).not.toHaveBeenCalled();
  });
});
