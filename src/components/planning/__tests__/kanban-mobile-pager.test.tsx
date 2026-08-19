import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { KanbanMobilePager } from "@/components/planning/kanban-mobile-pager";
import { BOARD_COLUMNS } from "@/types/task";
import type { Task, TaskStatus } from "@/types/task";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/planning/kanban-column", () => ({
  KanbanColumn: ({
    status,
    tasks,
    onAdd,
  }: {
    status: TaskStatus;
    tasks: Task[];
    onAdd?: () => void;
  }) => (
    <div data-testid="column" data-status={status}>
      {tasks.length}
      <button type="button" onClick={onAdd}>
        add
      </button>
    </div>
  ),
}));

function task(id: string, status: TaskStatus): Task {
  return {
    id,
    project_id: "p1",
    title: `Task ${id}`,
    description: null,
    status,
    priority: "medium",
    assignee_id: null,
    due_date: null,
    position: 0,
    labels: [],
  } as unknown as Task;
}

const tasksByStatus = {
  backlog: [task("b1", "backlog")],
  todo: [task("t1", "todo"), task("t2", "todo")],
  in_progress: [task("i1", "in_progress")],
  blocked: [],
  done: [task("d1", "done"), task("d2", "done"), task("d3", "done")],
} as Record<TaskStatus, Task[]>;

describe("KanbanMobilePager", () => {
  it("shows only the first board column initially", () => {
    render(
      <KanbanMobilePager
        tasksByStatus={tasksByStatus}
        onAdd={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    const columns = screen.getAllByTestId("column");
    expect(columns).toHaveLength(1);
    expect(columns[0]).toHaveAttribute("data-status", BOARD_COLUMNS[0]);
  });

  it("advances to the next column and back", () => {
    render(
      <KanbanMobilePager
        tasksByStatus={tasksByStatus}
        onAdd={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("pager.nextColumn"));
    expect(screen.getByTestId("column")).toHaveAttribute(
      "data-status",
      BOARD_COLUMNS[1]
    );

    fireEvent.click(screen.getByLabelText("pager.previousColumn"));
    expect(screen.getByTestId("column")).toHaveAttribute(
      "data-status",
      BOARD_COLUMNS[0]
    );
  });

  it("disables the arrows at each end of the board", () => {
    render(
      <KanbanMobilePager
        tasksByStatus={tasksByStatus}
        onAdd={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    expect(screen.getByLabelText("pager.previousColumn")).toBeDisabled();

    for (let i = 0; i < BOARD_COLUMNS.length - 1; i += 1) {
      fireEvent.click(screen.getByLabelText("pager.nextColumn"));
    }
    expect(screen.getByLabelText("pager.nextColumn")).toBeDisabled();
  });

  it("jumps straight to a column via its dot control", () => {
    render(
      <KanbanMobilePager
        tasksByStatus={tasksByStatus}
        onAdd={vi.fn()}
        onTaskClick={vi.fn()}
      />
    );

    const pager = screen.getByTestId("kanban-mobile-pager");
    const lastStatus = BOARD_COLUMNS[BOARD_COLUMNS.length - 1];
    fireEvent.click(within(pager).getByLabelText(`column.${lastStatus}`));

    expect(screen.getByTestId("column")).toHaveAttribute(
      "data-status",
      lastStatus
    );
  });

  it("seeds the create dialog with the column currently on screen", () => {
    const onAdd = vi.fn();
    render(
      <KanbanMobilePager
        tasksByStatus={tasksByStatus}
        onAdd={onAdd}
        onTaskClick={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText("pager.nextColumn"));
    fireEvent.click(screen.getByRole("button", { name: "add" }));

    expect(onAdd).toHaveBeenCalledWith(BOARD_COLUMNS[1]);
  });
});
