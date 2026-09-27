import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationRow } from "../notification-row";

const push = vi.fn();
const selectProject = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => "fr",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/context/ProjectContext", () => ({
  useProject: () => ({
    projects: [
      { id: "p-a", name: "Villa A", address: null },
      { id: "p-b", name: "Villa B", address: null },
    ],
    selectProject,
  }),
}));

function note(project_id: string) {
  return {
    note: {
      id: `n-${project_id}`,
      project_id,
      created_by: "u",
      title: "Permit renewal",
      description: null,
      category: "general" as const,
      status: "open" as const,
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
    },
    dismissed: false,
  };
}

describe("NotificationRow", () => {
  it("names the note's project so same-titled reminders can be told apart", () => {
    render(
      <>
        <NotificationRow item={note("p-a")} onDismiss={vi.fn()} onNavigate={vi.fn()} />
        <NotificationRow item={note("p-b")} onDismiss={vi.fn()} onNavigate={vi.fn()} />
      </>
    );
    expect(screen.getByText(/Villa A/)).toBeInTheDocument();
    expect(screen.getByText(/Villa B/)).toBeInTheDocument();
  });

  it("selects the note's project before opening its notes", () => {
    render(<NotificationRow item={note("p-b")} onDismiss={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "notifications.aria.goToNote" }));
    expect(selectProject).toHaveBeenCalledWith("p-b");
    expect(push).toHaveBeenCalledWith("/fr/projects/p-b/notes");
  });
});
