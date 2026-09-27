import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/lib/api/http";
import { deleteTask, updateTask } from "@/lib/api/task-api";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import type { Task } from "@/types/task";

vi.mock("@/lib/api/task-api", () => ({
  fetchTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  moveTask: vi.fn(),
}));

const { mockToast } = vi.hoisted(() => ({ mockToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("sonner", () => ({ toast: mockToast }));

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

  it("hides Delete from a caller who may not delete tasks", () => {
    renderDrawer();
    expect(screen.queryByRole("button", { name: en.planning.delete })).toBeNull();
  });

  it("keeps the drawer open and says why when a delete is refused", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteTask).mockRejectedValue(new ApiError("HTTP 403", 403));
    const onClose = renderDrawer(vi.fn(), { canDelete: true });
    await userEvent.click(screen.getByRole("button", { name: en.planning.delete }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(en.planning.errors.forbidden));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports a failed save instead of swallowing it", async () => {
    vi.mocked(updateTask).mockRejectedValue(new ApiError("HTTP 500", 500));
    renderDrawer();
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(en.planning.errors.save));
    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveValue("Pour slab");
  });
});
