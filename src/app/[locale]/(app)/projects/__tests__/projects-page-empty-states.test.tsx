/**
 * An empty project list explains itself: someone with no company at all is
 * pointed to onboarding (nobody can assign them), a manager or member of a
 * company waits to be assigned.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

const mockUseAuth = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
vi.mock("@/components/project/create-project-dialog", () => ({ CreateProjectDialog: () => null }));
vi.mock("@/components/project/edit-project-dialog", () => ({ EditProjectDialog: () => null }));
vi.mock("@/components/project/delete-project-dialog", () => ({ DeleteProjectDialog: () => null }));

import ProjectsPage from "../page";

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ProjectsPage />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ProjectsPage empty states", () => {
  it("sends someone with no company to onboarding", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [], companies: [] } });
    renderPage();
    expect(screen.getByText(enMessages.projects.noCompany.title)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: enMessages.projects.noCompany.cta })).toHaveAttribute(
      "href",
      "/en/onboarding"
    );
    expect(screen.queryByText(enMessages.projects.waitingForAssignment.title)).toBeNull();
  });

  it("tells a member of a company to wait for an assignment", () => {
    mockUseAuth.mockReturnValue({ user: { permissions: [], companies: [{ id: "c", role: "member" }] } });
    renderPage();
    expect(screen.getByText(enMessages.projects.waitingForAssignment.title)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.projects.noCompany.title)).toBeNull();
  });
});
