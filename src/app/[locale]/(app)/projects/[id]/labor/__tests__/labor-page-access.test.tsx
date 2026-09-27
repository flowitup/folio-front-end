/**
 * Labor page access: a caller who cannot see the project goes back to the
 * projects list instead of the manager shell with "Failed to load workers."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const REDIRECT = new Error("NEXT_REDIRECT");
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw REDIRECT;
  }),
}));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("fr") }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/projects-server", () => ({ getProjectById: vi.fn() }));
vi.mock("../labor-page-client", () => ({ LaborPageClient: () => null }));

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import LaborPage from "../page";

const PID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ id: PID });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "u1", permissions: ["project:manage_labor", "project:view_pay"] },
  } as never);
});

describe("LaborPage", () => {
  it("redirects a company manager who is not assigned to the project", async () => {
    vi.mocked(getProjectById).mockRejectedValue(new Error("403"));
    await expect(LaborPage({ params })).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/fr/projects");
  });

  it("renders the page for someone who can see the project", async () => {
    vi.mocked(getProjectById).mockResolvedValue({ id: PID, my_permissions: [] } as never);
    const el = await LaborPage({ params });
    expect(el).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the login page", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never);
    await expect(LaborPage({ params })).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/fr/login");
  });
});
