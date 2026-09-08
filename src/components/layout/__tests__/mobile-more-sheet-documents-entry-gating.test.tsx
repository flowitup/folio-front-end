/**
 * Mobile parity for the documents nav gate: the "More" sheet is the phone
 * counterpart of the desktop sidebar, so it must hide the documents entry for
 * the same callers (no effective `project:update`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MobileMoreSheet } from "../mobile-more-sheet";

// ---- Mocks ----

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/projects/p-1/notes",
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
}));

const mockUseProject = vi.fn();
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => mockUseProject(),
}));

const mockUseAuth = vi.fn();
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

// ---- Helpers ----

function setup(projectPerms: string[], globalPerms: string[] = ["project:read"]) {
  const project = { id: "p-1", name: "Site A", my_permissions: projectPerms };
  mockUseProject.mockReturnValue({
    projects: [project],
    selectedProjectId: "p-1",
    selectedProject: project,
    selectProject: vi.fn(),
  });
  mockUseAuth.mockReturnValue({ user: { permissions: globalPerms, companies: [] } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Tests ----

describe("MobileMoreSheet — documents entry gating", () => {
  it("hides the documents entry for a member (no project:update)", () => {
    setup(["project:read"]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.queryByText("navigation.documents")).toBeNull();
    expect(screen.getByText("navigation.notes")).toBeInTheDocument();
  });

  it("shows the documents entry for a manager (project:update)", () => {
    setup(["project:read", "project:update"]);
    render(<MobileMoreSheet open onClose={vi.fn()} />);
    expect(screen.getByText("navigation.documents")).toBeInTheDocument();
  });
});
