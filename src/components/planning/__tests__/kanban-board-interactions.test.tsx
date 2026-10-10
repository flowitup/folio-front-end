/**
 * KanbanBoard interactions:
 * - keyboard: Enter opens a card (board and backlog alike), Space picks a
 *   board card up to move it (Enter used to swallow the drag on board cards
 *   and start one on backlog cards);
 * - a card dragged down its lane lands where the preview showed it;
 * - a refused move says why and redraws the board without the full spinner;
 * - cards name their assignee.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { DndContextProps, DragEndEvent } from "@dnd-kit/core";
import en from "@/messages/en.json";
import { ApiError } from "@/lib/api/http";
import type { Task, TaskStatus } from "@/types/task";

const { mockReplace, mockToast, dnd } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  dnd: { props: null as DndContextProps | null },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  usePathname: () => "/en/projects/p-1/planning",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { permissions: [] } }) }));
vi.mock("@/context/ProjectContext", () => ({ useProject: () => ({ selectedProject: null }) }));
vi.mock("@/lib/api/task-api", () => ({ fetchTasks: vi.fn(), moveTask: vi.fn() }));
vi.mock("@/lib/api/projects", () => ({ fetchProjectUsers: vi.fn() }));
vi.mock("@/components/planning/task-detail-drawer", () => ({ TaskDetailDrawer: () => null }));
vi.mock("@/components/planning/task-create-dialog", () => ({ TaskCreateDialog: () => null }));
vi.mock("sonner", () => ({ toast: mockToast }));
// The real DndContext, with its props kept so a test can finish a drop.
vi.mock("@dnd-kit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...actual,
    DndContext: (props: DndContextProps) => {
      dnd.props = props;
      return <actual.DndContext {...props} />;
    },
  };
});

import { fetchTasks, moveTask } from "@/lib/api/task-api";
import { fetchProjectUsers } from "@/lib/api/projects";
import { KanbanBoard } from "../kanban-board";

function task(id: string, position: number, status: TaskStatus, extra: Partial<Task> = {}): Task {
  return {
    id,
    project_id: "p-1",
    title: `Task ${id}`,
    description: null,
    status,
    priority: "medium",
    assignee_id: null,
    due_date: null,
    position,
    labels: [],
    created_by: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...extra,
  };
}

const T1 = task("T1", 1000, "todo", { assignee_id: "u-dave" });
const T2 = task("T2", 2000, "todo");
const T3 = task("T3", 3000, "todo");
const T4 = task("T4", 4000, "todo");
const B1 = task("B1", 1000, "backlog");
const TASKS = [T1, T2, T3, T4, B1];

function renderBoard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <KanbanBoard projectId="p-1" />
    </NextIntlClientProvider>
  );
}

async function cardFor(t: Task) {
  const title = await screen.findByText(t.title);
  return title.closest('[aria-roledescription="sortable"]') as HTMLElement;
}

function dropEvent(dragged: Task, over: Task): DragEndEvent {
  return {
    active: { id: dragged.id, data: { current: { type: "task", task: dragged } } },
    over: { id: over.id, data: { current: { type: "task", task: over } } },
  } as unknown as DragEndEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  dnd.props = null;
  vi.mocked(fetchTasks).mockResolvedValue(TASKS);
  vi.mocked(fetchProjectUsers).mockResolvedValue({
    users: [{ id: "u-dave", email: "dave@example.com", display_name: "Dave Martin" }],
    total: 1,
  });
});

describe("KanbanBoard keyboard", () => {
  it("opens a board card with Enter without starting a drag", async () => {
    renderBoard();
    fireEvent.keyDown(await cardFor(T2), { key: "Enter", code: "Enter" });
    expect(mockReplace).toHaveBeenCalledWith("/en/projects/p-1/planning?task=T2", { scroll: false });
    expect(screen.queryByText(en.planning.dnd.pickedUp.replace("{title}", T2.title))).toBeNull();
  });

  it("picks a board card up with Space", async () => {
    renderBoard();
    fireEvent.keyDown(await cardFor(T2), { key: " ", code: "Space" });
    await waitFor(() =>
      expect(screen.getByText(en.planning.dnd.pickedUp.replace("{title}", T2.title))).toBeInTheDocument()
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("opens a backlog card with Enter instead of picking it up", async () => {
    renderBoard();
    fireEvent.keyDown(await cardFor(B1), { key: "Enter", code: "Enter" });
    expect(mockReplace).toHaveBeenCalledWith("/en/projects/p-1/planning?task=B1", { scroll: false });
    expect(screen.queryByText(en.planning.dnd.pickedUp.replace("{title}", B1.title))).toBeNull();
  });
});

describe("KanbanBoard drop", () => {
  it("sends the neighbours the preview showed for a card dragged down its lane", async () => {
    vi.mocked(moveTask).mockResolvedValue({ ...T1, position: 3500 });
    renderBoard();
    await cardFor(T1);
    await act(async () => {
      await dnd.props!.onDragEnd!(dropEvent(T1, T3));
    });
    expect(moveTask).toHaveBeenCalledWith("T1", { status: "todo", before_id: "T3", after_id: "T4" });
  });

  it("says why a move failed and keeps the board on screen while it reloads", async () => {
    vi.mocked(moveTask).mockRejectedValue(new ApiError("HTTP 404", 404));
    renderBoard();
    await cardFor(T1);
    let resolveReload: (tasks: Task[]) => void = () => {};
    vi.mocked(fetchTasks).mockReturnValueOnce(new Promise((r) => { resolveReload = r; }));

    await act(async () => {
      await dnd.props!.onDragEnd!(dropEvent(T1, T3));
    });

    expect(mockToast.error).toHaveBeenCalledWith(en.planning.errors.notFound);
    expect(fetchTasks).toHaveBeenCalledTimes(2);
    // Silent reload: the lanes stay while the board is fetched again.
    expect(screen.getByText(en.planning.column.todo)).toBeInTheDocument();
    await act(async () => resolveReload(TASKS.filter((t) => t.id !== "T1")));
    await waitFor(() => expect(screen.queryByText(T1.title)).toBeNull());
  });
});

describe("KanbanBoard assignee", () => {
  it("names the assignee on the card", async () => {
    renderBoard();
    const card = await cardFor(T1);
    await waitFor(() => expect(card).toHaveTextContent("Dave Martin"));
    expect(card).toHaveTextContent(en.planning.assignedTo.replace("{name}", "Dave Martin"));
    expect(await cardFor(T2)).not.toHaveTextContent("Dave Martin");
  });
});
