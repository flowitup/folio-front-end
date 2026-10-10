/**
 * Projects list — saving the edit dialog confirms it with a toast, as create
 * and delete do (it used to close silently), and the team panel's remove
 * buttons and their confirmation are labelled for screen readers in the
 * user's language.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import frMessages from "@/messages/fr.json";
import type { Project } from "@/types/project";
import { fetchProjectUsers } from "@/lib/api/projects";

const { mockRefetch, mockToastSuccess } = vi.hoisted(() => ({
  mockRefetch: vi.fn(),
  mockToastSuccess: vi.fn(),
}));
const mockUseAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/en/projects",
}));

const PROJECT: Project = {
  id: "p-1",
  name: "Villa",
  address: "5 rue UI, Paris",
  owner_id: "u-1",
  user_count: 2,
  created_at: "2026-09-01T00:00:00Z",
  company_id: "co-1",
  my_permissions: ["project:read", "project:update", "project:manage_users"],
};

vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [PROJECT],
    isLoading: false,
    error: null,
    selectedProjectId: null,
    selectProject: vi.fn(),
    refetch: mockRefetch,
  }),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));

vi.mock("@/lib/api/projects", () => ({
  fetchProjectUsers: vi.fn().mockResolvedValue({ users: [] }),
}));

vi.mock("@/app/[locale]/(app)/projects/[id]/members/actions", () => ({
  removeMemberAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: mockToastSuccess, error: vi.fn() } }));

vi.mock("@/components/project/project-cover-photos", () => ({ ProjectCoverPhotos: () => null }));
vi.mock("@/components/project/create-project-dialog", () => ({ CreateProjectDialog: () => null }));
vi.mock("@/components/project/delete-project-dialog", () => ({ DeleteProjectDialog: () => null }));
// The dialog itself is tested on its own: here it only reports a saved edit.
vi.mock("@/components/project/edit-project-dialog", () => ({
  EditProjectDialog: ({ open, onUpdated }: { open: boolean; onUpdated?: () => Promise<void> }) =>
    open ? (
      <button type="button" onClick={() => void onUpdated?.()}>
        mock-save-edit
      </button>
    ) : null,
}));

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

function renderPage(locale: "en" | "fr" = "en") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages}>
      <ProjectsPage />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRefetch.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({
    user: {
      id: "u-me",
      permissions: [],
      companies: [{ id: "co-1", name: "Co", role: "admin" }],
    },
  });
});

describe("ProjectsPage — editing a project", () => {
  it("confirms a saved edit with a toast once the list is reloaded", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(enMessages.projects.editProject) }));
    fireEvent.click(screen.getByRole("button", { name: "mock-save-edit" }));

    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith(enMessages.projects.projectUpdated));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe("ProjectsPage team panel — remove", () => {
  it("names the person on each remove button and describes the confirmation, in the user's language", async () => {
    vi.mocked(fetchProjectUsers).mockResolvedValueOnce({
      users: [
        { id: "u-d", email: "dave@example.com", display_name: "Dave", role_name: "member" },
        { id: "u-e", email: "eve@example.com", display_name: "Eve", role_name: "member" },
      ],
      total: 2,
    });
    renderPage("fr");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(frMessages.projects.showTeam) }));

    // Was a hard-coded English "Remove" on every row.
    const removeDave = await screen.findByRole("button", { name: "Retirer dave@example.com" });
    expect(screen.getByRole("button", { name: "Retirer eve@example.com" })).toBeInTheDocument();

    fireEvent.click(removeDave);
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription("dave@example.com");
  });
});
