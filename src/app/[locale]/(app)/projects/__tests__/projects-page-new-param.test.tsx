/**
 * ?new=1 (from the top bar) opens the create-project dialog only for someone
 * who may create a project; the parameter is always removed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

const replace = vi.fn();
const mockUseAuth = vi.fn();
const dialogOpen = vi.fn();
const dialogProps: { onCreated?: (p: unknown) => Promise<void>; onDeleted?: () => Promise<void> } = {};
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams("new=1"),
  usePathname: () => "/en/projects",
}));
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [],
    isLoading: false,
    error: null,
    selectedProjectId: null,
    selectProject: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => mockUseAuth() }));
vi.mock("@/lib/api/projects", () => ({ fetchProjectUsers: vi.fn() }));
vi.mock("@/app/[locale]/(app)/projects/[id]/members/actions", () => ({ removeMemberAction: vi.fn() }));
vi.mock("@/components/project/project-cover-photos", () => ({ ProjectCoverPhotos: () => null }));
vi.mock("@/components/project/create-project-dialog", () => ({
  CreateProjectDialog: ({ open, onCreated }: { open: boolean; onCreated: (p: unknown) => Promise<void> }) => {
    dialogOpen(open);
    dialogProps.onCreated = onCreated;
    return null;
  },
}));
vi.mock("@/components/project/edit-project-dialog", () => ({ EditProjectDialog: () => null }));
vi.mock("@/components/project/delete-project-dialog", () => ({
  DeleteProjectDialog: ({ onDeleted }: { onDeleted: () => Promise<void> }) => {
    dialogProps.onDeleted = onDeleted;
    return null;
  },
}));

import ProjectsPage from "../page";

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ProjectsPage />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectsPage ?new=1", () => {
  it("does not open the create dialog for a manager or member", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: ["project:create"], companies: [{ id: "c", role: "manager" }] } });
    renderPage();
    expect(dialogOpen).not.toHaveBeenCalledWith(true);
    expect(replace).toHaveBeenCalledWith("/en/projects");
  });

  it("opens it for a company admin", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [], companies: [{ id: "c", role: "admin" }] } });
    renderPage();
    expect(dialogOpen).toHaveBeenLastCalledWith(true);
  });

  it("keeps the parameter until the user has loaded", () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderPage();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("ProjectsPage create and delete feedback", () => {
  it("confirms a created and a deleted project", async () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [], companies: [{ id: "c", role: "admin" }] } });
    renderPage();
    await dialogProps.onCreated!({ id: "new-1" });
    expect(toastSuccess).toHaveBeenCalledWith(enMessages.projects.projectCreated);
    await dialogProps.onDeleted!();
    expect(toastSuccess).toHaveBeenCalledWith(enMessages.projects.projectDeleted);
  });
});
