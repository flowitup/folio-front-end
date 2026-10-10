/**
 * TaskDetailDrawer keeps what the user typed:
 * - changing the status (or a board refresh handing in a fresh copy of the
 *   task) used to re-seed the form and silently drop unsaved edits;
 * - the backdrop, the X and Escape ask before discarding edits.
 * It also edits the assignee, as mobile and the API allow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Task, TaskAssignee } from "@/types/task";

const { mockMove, mockUpdate } = vi.hoisted(() => ({ mockMove: vi.fn(), mockUpdate: vi.fn() }));
vi.mock("@/lib/api/task-api", () => ({
  fetchTask: vi.fn(),
  updateTask: mockUpdate,
  deleteTask: vi.fn(),
  moveTask: mockMove,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Native <select> stand-in for the Radix Select.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

import { TaskDetailDrawer } from "../task-detail-drawer";

const TASK: Task = {
  id: "t1",
  project_id: "p1",
  title: "Pour slab",
  description: null,
  status: "todo",
  priority: "medium",
  assignee_id: null,
  due_date: null,
  position: 1000,
  labels: [],
  created_by: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const ASSIGNEES: TaskAssignee[] = [
  { id: "u-dave", name: "Dave Martin" },
  { id: "u-eve", name: "Eve Durand" },
];

function drawer(seed: Task, onClose = vi.fn()) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <TaskDetailDrawer taskId={seed.id} seed={seed} onClose={onClose} assignees={ASSIGNEES} />
    </NextIntlClientProvider>
  );
}

const typeTitle = (value: string) =>
  fireEvent.change(screen.getByLabelText(en.planning.titleLabel), { target: { value } });

const backdrop = () => document.querySelector("div.fixed.inset-0") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("TaskDetailDrawer unsaved edits", () => {
  it("keeps the typed title and description when the status changes", async () => {
    mockMove.mockResolvedValue({ ...TASK, status: "in_progress", position: 5000 });
    const { rerender } = render(drawer(TASK));
    fireEvent.change(screen.getByLabelText(en.planning.titleLabel), { target: { value: "Pour slab, east side" } });
    fireEvent.change(screen.getByLabelText(en.planning.descriptionLabel), {
      target: { value: "unsaved description" },
    });

    await userEvent.selectOptions(screen.getByDisplayValue(en.planning.column.todo), "in_progress");
    await waitFor(() => expect(mockMove).toHaveBeenCalledWith("t1", { status: "in_progress" }));
    // The board then refreshes and hands in another copy of the task.
    rerender(drawer({ ...TASK, status: "in_progress", position: 5000 }));

    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveValue("Pour slab, east side");
    expect(screen.getByLabelText(en.planning.descriptionLabel)).toHaveValue("unsaved description");
  });

  it("asks before the backdrop discards unsaved edits", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onClose = vi.fn();
    render(drawer(TASK, onClose));
    typeTitle("Pour slab now");

    fireEvent.click(backdrop());
    expect(confirm).toHaveBeenCalledWith(en.planning.discardChanges);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveValue("Pour slab now");

    confirm.mockReturnValue(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes without asking when nothing was changed", () => {
    const confirm = vi.spyOn(window, "confirm");
    const onClose = vi.fn();
    render(drawer(TASK, onClose));
    fireEvent.click(screen.getByRole("button", { name: en.planning.close }));
    fireEvent.click(backdrop());
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not ask once the edits are saved", async () => {
    const confirm = vi.spyOn(window, "confirm");
    mockUpdate.mockImplementation(async (_id: string, payload: Partial<Task>) => ({ ...TASK, ...payload }));
    const onClose = vi.fn();
    render(drawer(TASK, onClose));
    typeTitle("Pour slab now");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());

    fireEvent.click(backdrop());
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("TaskDetailDrawer assignee", () => {
  const assigneeSelect = () => screen.getByRole("option", { name: en.planning.unassigned }).closest("select")!;

  it("assigns the task to the member picked", async () => {
    mockUpdate.mockResolvedValue({ ...TASK, assignee_id: "u-eve" });
    render(drawer(TASK));
    expect(assigneeSelect()).toHaveValue("__unassigned__");
    await userEvent.selectOptions(assigneeSelect(), "u-eve");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("t1", expect.objectContaining({ assignee_id: "u-eve" }))
    );
  });

  it("unassigns it with an explicit null", async () => {
    mockUpdate.mockResolvedValue(TASK);
    render(drawer({ ...TASK, assignee_id: "u-dave" }));
    expect(assigneeSelect()).toHaveValue("u-dave");
    await userEvent.selectOptions(assigneeSelect(), "__unassigned__");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("t1", expect.objectContaining({ assignee_id: null }))
    );
  });

  it("leaves an assignee missing from the member list alone when saving other fields", async () => {
    mockUpdate.mockResolvedValue(TASK);
    render(drawer({ ...TASK, assignee_id: "u-admin" }));
    expect(assigneeSelect()).toHaveValue("u-admin");
    expect(screen.getByRole("option", { name: en.planning.assigneeOther })).toBeInTheDocument();
    typeTitle("Pour slab now");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty("assignee_id");
  });
});
