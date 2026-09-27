/**
 * Chiffrage page access and load failures: a caller who cannot see the project
 * is sent back to the projects list (as on the other project tabs), a failed
 * tree load is reported as an error rather than an empty budget, and write
 * controls come only from the loaded project's effective permissions.
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
vi.mock("@/lib/api/chiffrage", () => ({ getChiffrage: vi.fn(), listUnits: vi.fn() }));
vi.mock("../chiffrage-page-client", () => ({ ChiffragePageClient: () => null }));

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import { getChiffrage, listUnits } from "@/lib/api/chiffrage";
import ChiffragePage from "../page";

const PID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ id: PID });

function clientProps(el: unknown): Record<string, unknown> {
  // <div><ChiffragePageClient …/></div>
  return (el as { props: { children: { props: Record<string, unknown> } } }).props.children.props;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "u1", permissions: ["project:manage_invoices"] },
  } as never);
  vi.mocked(listUnits).mockResolvedValue([]);
});

describe("ChiffragePage", () => {
  it("redirects a caller who cannot access the project", async () => {
    vi.mocked(getProjectById).mockRejectedValue(new Error("403"));
    vi.mocked(getChiffrage).mockRejectedValue(new Error("403"));
    await expect(ChiffragePage({ params })).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/fr/projects");
  });

  it("flags a failed tree load instead of rendering an empty budget", async () => {
    vi.mocked(getProjectById).mockResolvedValue({ id: PID, my_permissions: ["project:read"] } as never);
    vi.mocked(getChiffrage).mockRejectedValue(new Error("500"));
    const props = clientProps(await ChiffragePage({ params }));
    expect(props.loadFailed).toBe(true);
  });

  it("grants no write controls to platform ops when the project could not be loaded", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "ops", permissions: ["*:*"] } } as never);
    vi.mocked(getProjectById).mockRejectedValue(new Error("404"));
    vi.mocked(getChiffrage).mockRejectedValue(new Error("404"));
    const props = clientProps(await ChiffragePage({ params }));
    expect(props.canManage).toBe(false);
    expect(props.loadFailed).toBe(true);
  });
});
