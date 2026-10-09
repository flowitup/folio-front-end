/**
 * Notes page access: a caller who cannot open the project is sent back to the
 * projects list (as on the other project tabs) instead of seeing an empty
 * journal with a quick-add that can only fail, and write controls come only
 * from the loaded project's effective permissions.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const REDIRECT = new Error("NEXT_REDIRECT");
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw REDIRECT;
  }),
}));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn().mockResolvedValue("en") }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/api/projects-server", () => ({ getProjectById: vi.fn() }));
vi.mock("@/lib/api/notes", () => ({ listProjectNotes: vi.fn() }));
vi.mock("../notes-view", () => ({ NotesView: () => null }));

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getProjectById } from "@/lib/api/projects-server";
import { listProjectNotes } from "@/lib/api/notes";
import NotesPage from "../page";

const PID = "11111111-1111-4111-8111-111111111111";
const params = Promise.resolve({ id: PID });

function viewProps(el: unknown): Record<string, unknown> {
  // <div><NotesView …/></div>
  return (el as { props: { children: { props: Record<string, unknown> } } }).props.children.props;
}

beforeEach(() => {
  vi.clearAllMocks();
  // A manager's company-wide claim carries project:update.
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "u1", permissions: ["project:read", "project:update"] },
  } as never);
  vi.mocked(listProjectNotes).mockResolvedValue({ items: [], count: 0 } as never);
});

describe("NotesPage", () => {
  it("redirects a caller who cannot access the project", async () => {
    vi.mocked(getProjectById).mockRejectedValue(new Error("403"));
    vi.mocked(listProjectNotes).mockRejectedValue(new Error("403"));
    await expect(NotesPage({ params })).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/en/projects");
  });

  it("lets a project manager write", async () => {
    vi.mocked(getProjectById).mockResolvedValue({
      id: PID,
      my_permissions: ["project:read", "project:update"],
    } as never);
    expect(viewProps(await NotesPage({ params })).canEdit).toBe(true);
  });

  it("keeps a member read-only even when the JWT claim carries project:update", async () => {
    vi.mocked(getProjectById).mockResolvedValue({ id: PID, my_permissions: ["project:read"] } as never);
    expect(viewProps(await NotesPage({ params })).canEdit).toBe(false);
  });

  it("grants no write controls to platform ops when the project could not be loaded", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: { id: "ops", permissions: ["*:*"] } } as never);
    vi.mocked(getProjectById).mockRejectedValue(new Error("404"));
    const props = viewProps(await NotesPage({ params }));
    expect(redirect).not.toHaveBeenCalled();
    expect(props.canEdit).toBe(false);
  });
});
