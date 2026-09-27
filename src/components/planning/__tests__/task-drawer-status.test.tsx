/**
 * The drawer can move a task to another lane, so status is not drag-only
 * (touch screens could not change it at all).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Task } from "@/types/task";

const { mockMove } = vi.hoisted(() => ({ mockMove: vi.fn() }));
vi.mock("@/lib/api/task-api", () => ({
  fetchTask: vi.fn(),
  updateTask: vi.fn(),
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
  position: 0,
  labels: [],
  created_by: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

describe("TaskDetailDrawer status", () => {
  it("moves the task to the lane picked in the drawer", async () => {
    mockMove.mockResolvedValue({ ...TASK, status: "done" });
    const onMutated = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <TaskDetailDrawer taskId="t1" seed={TASK} onClose={vi.fn()} onMutated={onMutated} />
      </NextIntlClientProvider>
    );

    const status = screen.getByDisplayValue(en.planning.column.todo);
    expect(Array.from((status as HTMLSelectElement).options).map((o) => o.value)).toEqual([
      "backlog",
      "todo",
      "in_progress",
      "blocked",
      "done",
    ]);
    await userEvent.selectOptions(status, "done");

    await waitFor(() => expect(mockMove).toHaveBeenCalledWith("t1", { status: "done" }));
    expect(onMutated).toHaveBeenCalled();
  });
});
