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
import { fetchProjectUsers } from "@/lib/api/projects";

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

describe("ProjectsPage team panel — roles", () => {
  it("labels each person with their company role, not 'Member' for everyone", async () => {
    vi.mocked(fetchProjectUsers).mockResolvedValueOnce({
      users: [
        { id: "u-a", email: "admin@example.com", display_name: "Ann", role_name: "admin" },
        { id: "u-m", email: "alice@example.com", display_name: "Alice", role_name: "manager" },
        { id: "u-x", email: "gone@example.com", display_name: null, role_name: null },
      ],
      total: 3,
    });
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    await openTeam();

    expect(await screen.findByText(enMessages.members.roles.admin)).toBeInTheDocument();
    expect(screen.getByText(enMessages.members.roles.manager)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.members.roles.member)).toBeNull();
  });
});

describe("ProjectsPage card labels", () => {
  it("shows no no-op Active tab, no English phase and a padded index", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    expect(screen.queryByRole("button", { name: /Active/ })).toBeNull();
    expect(screen.queryByText("Planning")).toBeNull();
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByTestId("project-team-size")).toHaveTextContent("1 member");
  });
});

describe("ProjectsPage card layout", () => {
  it("keeps an unbroken title inside the card", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    const title = screen.getByTestId("project-card-title");
    expect(title.className).toContain("[overflow-wrap:anywhere]");
    const grid = title.closest("article")!.firstElementChild as HTMLElement;
    expect(grid.className).toContain("minmax(0,");
  });
});

describe("ProjectsPage money columns", () => {
  it("hides the spend columns the API zeroes for a read-only member", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    expect(screen.queryByText(enMessages.projects.spentByCredits)).toBeNull();
    expect(screen.queryByText(enMessages.projects.spentPersonal)).toBeNull();
    expect(screen.queryByTestId("project-money-grid")).toBeNull();
  });

  it("shows them to someone with labor rights", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read", "project:manage_labor"], companies: [] } });
    renderPage();
    expect(screen.getByText(enMessages.projects.spentByCredits)).toBeInTheDocument();
    expect(screen.getByText(enMessages.projects.spentPersonal)).toBeInTheDocument();
  });

  it("goes to four columns only when the card is wide enough, and lets figures wrap", () => {
    mockUseAuth.mockReturnValue({
      user: { permissions: ["project:read", "project:view_budget", "project:manage_labor"], companies: [] },
    });
    renderPage();
    const grid = screen.getByTestId("project-money-grid");
    // A container query on the card, not the viewport: half-width cards on a
    // laptop left ~40-60px per figure and the amounts ran into each other.
    expect(grid.className).toContain("@lg:grid-cols-4");
    expect(grid.className).not.toMatch(/(^|\s)sm:grid-cols-4/);
    expect(grid.parentElement!.className).toContain("@container");
    // Labels share one grid row and figures the next, so a label that wraps
    // further in one locale never pushes its figure below the others.
    const items = Array.from(grid.children) as HTMLElement[];
    const labels = items.filter((el) => el.className.includes("label-cap"));
    const figures = items.filter((el) => !el.className.includes("label-cap"));
    expect(labels.map((el) => el.textContent)).toEqual([
      enMessages.projects.creditTotal,
      enMessages.projects.spentByCredits,
      enMessages.projects.spentPersonal,
      enMessages.projects.remaining,
    ]);
    expect(labels.map((el) => el.className.match(/(^|\s)(@lg:)?row-start-\d/g)?.join("").trim())).toEqual([
      "row-start-1",
      "row-start-1",
      "row-start-3 @lg:row-start-1",
      "row-start-3 @lg:row-start-1",
    ]);
    expect(figures.map((el) => el.className.match(/(^|\s)(@lg:)?row-start-\d/g)?.join("").trim())).toEqual([
      "row-start-2",
      "row-start-2",
      "row-start-4 @lg:row-start-2",
      "row-start-4 @lg:row-start-2",
    ]);
    for (const figure of figures) expect(figure.className).toContain("[overflow-wrap:anywhere]");
  });

  it("keeps the two figures of a two-column grid on the first pair of rows", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read", "project:manage_labor"], companies: [] } });
    renderPage();
    const items = Array.from(screen.getByTestId("project-money-grid").children) as HTMLElement[];
    expect(items.map((el) => el.className.match(/(^|\s)row-start-\d/)?.[0].trim())).toEqual([
      "row-start-1",
      "row-start-2",
      "row-start-1",
      "row-start-2",
    ]);
  });
});

describe("ProjectsPage team panel — Remove", () => {
  async function openTeamWith(user: object) {
    vi.mocked(fetchProjectUsers).mockResolvedValueOnce({
      users: [
        { id: "me", email: "alice@example.com", display_name: "Alice", role_name: "manager" },
        { id: "u-d", email: "dave@example.com", display_name: "Dave", role_name: "member" },
        { id: "u-b", email: "bob@example.com", display_name: "Bob", role_name: "manager" },
        { id: "u-a", email: "ann@example.com", display_name: "Ann", role_name: "admin" },
      ],
      total: 4,
    });
    mockUseAuth.mockReturnValue({ user });
    renderPage();
    await openTeam();
    await screen.findByText("dave@example.com");
  }
  const removeButtons = () =>
    screen.queryAllByRole("button", { name: /^Remove / }).map((b) => b.getAttribute("aria-label"));

  it("offers a manager Remove only on company members, never on themselves", async () => {
    await openTeamWith({
      id: "me",
      permissions: ["project:read", "project:manage_users"],
      companies: [{ id: "co-1", name: "Co", role: "manager" }],
    });
    expect(removeButtons()).toEqual(["Remove dave@example.com"]);
  });

  it("offers a company admin Remove on everyone else", async () => {
    await openTeamWith({
      id: "me",
      permissions: ["project:read", "project:manage_users"],
      companies: [{ id: "co-1", name: "Co", role: "admin" }],
    });
    expect(removeButtons()).toEqual([
      "Remove dave@example.com",
      "Remove bob@example.com",
      "Remove ann@example.com",
    ]);
  });
});

describe("ProjectsPage search", () => {
  it("says when nothing matches, counts what is shown, and clears back to the list", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:read"], companies: [] } });
    renderPage();
    const search = screen.getByPlaceholderText(enMessages.projects.searchProjects);

    fireEvent.change(search, { target: { value: "zzzzzz" } });
    expect(screen.queryByTestId("project-card-title")).toBeNull();
    expect(screen.getByTestId("projects-no-search-results")).toHaveTextContent("No project matches “zzzzzz”");
    expect(screen.getByTestId("projects-count")).toHaveTextContent("0 / 1");

    fireEvent.click(screen.getByRole("button", { name: enMessages.projects.noSearchResults.clear }));
    expect(search).toHaveValue("");
    expect(screen.queryByTestId("projects-no-search-results")).toBeNull();
    expect(screen.getByTestId("project-card-title")).toBeInTheDocument();
    expect(screen.getByTestId("projects-count")).toHaveTextContent(/· 1$/);
  });
});
