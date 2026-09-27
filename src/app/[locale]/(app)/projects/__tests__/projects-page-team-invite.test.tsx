/**
 * Projects list team panel — the Invite button opens the project's members
 * page (e-mail invitation + company-scoped assignment). It used to open a
 * dialog that searched users of every company and posted to the retired
 * POST /projects/<id>/users route, which always answers 410 Gone.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { Project } from "@/types/project";

const push = vi.fn();
const selectProject = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/projects",
}));

const PROJECT: Project = {
  id: "p-1",
  name: "Villa",
  address: "5 rue UI, Paris",
  owner_id: "u-1",
  user_count: 1,
  created_at: "2026-09-01T00:00:00Z",
  company_id: "co-1",
  my_permissions: [],
};

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [PROJECT],
    isLoading: false,
    error: null,
    selectedProjectId: null,
    selectProject,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/lib/api/projects", () => ({
  fetchProjectUsers: vi.fn().mockResolvedValue({ users: [] }),
}));

vi.mock("@/app/[locale]/(app)/projects/[id]/members/actions", () => ({
  removeMemberAction: vi.fn(),
}));

vi.mock("@/components/project/project-cover-photos", () => ({ ProjectCoverPhotos: () => null }));
vi.mock("@/components/project/create-project-dialog", () => ({ CreateProjectDialog: () => null }));
vi.mock("@/components/project/edit-project-dialog", () => ({ EditProjectDialog: () => null }));
vi.mock("@/components/project/delete-project-dialog", () => ({ DeleteProjectDialog: () => null }));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => null,
  DropdownMenuItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
}));

import ProjectsPage from "../page";

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ProjectsPage />
    </NextIntlClientProvider>
  );
}

async function openTeam() {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(enMessages.projects.showTeam) }));
  await waitFor(() => expect(screen.getByText(enMessages.projects.teamMembers)).toBeDefined());
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectsPage team panel — Invite", () => {
  it("opens the project's members page instead of the retired add-user dialog", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:invite", "project:update"], companies: [] } });
    renderPage();
    await openTeam();

    fireEvent.click(screen.getByRole("button", { name: enMessages.projects.invite }));

    expect(selectProject).toHaveBeenCalledWith("p-1");
    expect(push).toHaveBeenCalledWith("/en/projects/p-1/members");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is hidden for a user who can neither invite nor assign", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    await openTeam();

    expect(screen.queryByRole("button", { name: enMessages.projects.invite })).toBeNull();
  });
});
