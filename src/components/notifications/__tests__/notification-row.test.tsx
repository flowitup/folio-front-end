import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationRow } from "../notification-row";

const push = vi.fn();
const selectProject = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string, vars?: Record<string, string>) =>
    vars?.date ? `${ns}.${key}:${vars.date}` : `${ns}.${key}`,
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

function note(project_id: string, due_date: string | null = null) {
  return {
    note: {
      due_date,
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

  it("hides the dismiss button behind hover only on devices that can hover", () => {
    render(<NotificationRow item={note("p-a")} onDismiss={vi.fn()} onNavigate={vi.fn()} />);
    const dismiss = screen.getByRole("button", { name: "notifications.dismissButton" });
    // Visible by default (touch screens have no hover to reveal it).
    expect(dismiss.className).toMatch(/(^| )opacity-100( |$)/);
    expect(dismiss.className).toContain("[@media(hover:hover)]:opacity-0");
    expect(dismiss.className).not.toMatch(/(^| )opacity-0( |$)/);
  });

  it("selects the note's project before opening its notes", () => {
    render(<NotificationRow item={note("p-b")} onDismiss={vi.fn()} onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "notifications.aria.goToNote" }));
    expect(selectProject).toHaveBeenCalledWith("p-b");
    expect(push).toHaveBeenCalledWith("/fr/projects/p-b/notes");
  });

  it("shows when the reminder is due, in red once it is overdue", () => {
    render(
      <>
        <NotificationRow item={note("p-a", "2000-01-08")} onDismiss={vi.fn()} onNavigate={vi.fn()} />
        <NotificationRow item={note("p-b", "2999-12-31")} onDismiss={vi.fn()} onNavigate={vi.fn()} />
      </>
    );
    expect(screen.getByText("notifications.due:08/01/2000")).toHaveStyle({ color: "var(--negative)" });
    expect(screen.getByText("notifications.due:31/12/2999")).toHaveStyle({ color: "var(--muted-foreground)" });
  });

  it("shows no due line when the API sends none", () => {
    render(<NotificationRow item={note("p-a")} onDismiss={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.queryByText(/notifications\.due/)).toBeNull();
  });
});
