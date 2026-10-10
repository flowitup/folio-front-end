/**
 * A failed project list load shows a translated message with a retry, never
 * ApiError's raw English "HTTP 500: Internal Server Error".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import frMessages from "@/messages/fr.json";

const mockRefetch = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/fr/projects",
}));
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [],
    isLoading: false,
    error: "load_failed",
    selectedProjectId: null,
    selectProject: vi.fn(),
    refetch: mockRefetch,
  }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { permissions: ["project:create"], companies: [{ id: "c", role: "admin" }] } }),
}));
vi.mock("@/lib/api/projects", () => ({ fetchProjectUsers: vi.fn() }));
vi.mock("@/app/[locale]/(app)/projects/[id]/members/actions", () => ({ removeMemberAction: vi.fn() }));
vi.mock("@/components/project/project-cover-photos", () => ({ ProjectCoverPhotos: () => null }));
vi.mock("@/components/project/create-project-dialog", () => ({ CreateProjectDialog: () => null }));
vi.mock("@/components/project/edit-project-dialog", () => ({ EditProjectDialog: () => null }));
vi.mock("@/components/project/delete-project-dialog", () => ({ DeleteProjectDialog: () => null }));

import ProjectsPage from "../page";

beforeEach(() => vi.clearAllMocks());

describe("ProjectsPage load failure", () => {
  it("shows a translated error with a retry instead of the raw API message", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={frMessages}>
        <ProjectsPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByTestId("projects-load-error")).toHaveTextContent(frMessages.projects.loadError);
    expect(screen.queryByText(/HTTP 500/)).toBeNull();
    expect(screen.queryByText("load_failed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: frMessages.projects.retry }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
