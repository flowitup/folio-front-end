import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Task } from "@/types/task";

vi.mock("@/lib/api/task-api", () => ({
  fetchTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
}));

import { TaskDetailDrawer } from "../task-detail-drawer";

const TASK: Task = {
  id: "t1",
  project_id: "p1",
  title: "Pour slab",
  description: "Description A",
  status: "todo",
  priority: "medium",
  assignee_id: null,
  due_date: "2026-09-30",
  position: 0,
  labels: [],
  created_by: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

function renderDrawer(onClose = vi.fn(), props: Partial<Parameters<typeof TaskDetailDrawer>[0]> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <div className="fade-up" data-testid="page-wrapper">
        <TaskDetailDrawer taskId="t1" seed={TASK} onClose={onClose} {...props} />
      </div>
    </NextIntlClientProvider>
  );
  return onClose;
}

beforeEach(() => vi.clearAllMocks());

describe("TaskDetailDrawer", () => {
  it("renders outside the page wrapper so it can cover the whole screen", () => {
    renderDrawer();
    const drawer = screen.getByRole("dialog");
    expect(screen.getByTestId("page-wrapper").contains(drawer)).toBe(false);
    expect(drawer.parentElement).toBe(document.body);
  });

  it("closes on a plain Escape", () => {
    const onClose = renderDrawer();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a nested layer already handled the Escape", () => {
    const onClose = renderDrawer();
    const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(onClose).not.toHaveBeenCalled();
  });
});
