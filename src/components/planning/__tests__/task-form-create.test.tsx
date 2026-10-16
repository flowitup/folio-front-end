/**
 * TaskForm in create mode: a Status field showing the lane (mobile parity),
 * due dates bounded like the API (2000–2100) with their own message, the
 * title focused only when creating, and "dirty" reported as soon as
 * something is typed so the create dialog can ask before discarding it.
 */

import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { TaskForm } from "../task-form";
import type { Task } from "@/types/task";

function renderForm(props: Partial<React.ComponentProps<typeof TaskForm>> = {}) {
  const onSubmit = vi.fn();
  const onDirtyChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <TaskForm onSubmit={onSubmit} onCancel={vi.fn()} onDirtyChange={onDirtyChange} {...props} />
    </NextIntlClientProvider>
  );
  return { onSubmit, onDirtyChange };
}

describe("TaskForm — create mode", () => {
  it("shows the lane as the Status and sends it", async () => {
    const { onSubmit } = renderForm({ defaultStatus: "in_progress" });
    expect(screen.getByLabelText(en.planning.statusLabel)).toHaveTextContent(en.planning.column.in_progress);
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    await userEvent.click(screen.getByRole("button", { name: en.planning.save }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: "in_progress" }));
  });

  it("refuses a due date outside 2000–2100 with a message about the date", async () => {
    const { onSubmit } = renderForm({ defaultStatus: "todo" });
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "Pour slab");
    fireEvent.change(screen.getByLabelText(en.planning.dueDateLabel), { target: { value: "2101-01-01" } });
    // Browsers that enforce min/max stop the submit natively; the form's own
    // check covers the others (and names the date in the app's language).
    const form = screen.getByRole("button", { name: en.planning.save }).closest("form");
    fireEvent.submit(form as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(en.planning.errors.dueDate);
    expect(screen.getByLabelText(en.planning.dueDateLabel)).toHaveAttribute("max", "2100-12-31");
  });

  it("focuses the title and reports dirty once something is typed", async () => {
    const { onDirtyChange } = renderForm({ defaultStatus: "todo" });
    expect(screen.getByLabelText(en.planning.titleLabel)).toHaveFocus();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await userEvent.type(screen.getByLabelText(en.planning.titleLabel), "x");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("does not focus the title when opening an existing task", () => {
    const task: Task = {
      id: "t1",
      project_id: "p1",
      title: "Existing",
      description: null,
      status: "todo",
      priority: "medium",
      due_date: null,
      labels: [],
      assignee_id: null,
      position: 0,
      created_by: "u1",
      created_at: "2026-10-01T00:00:00",
      updated_at: "2026-10-01T00:00:00",
    } as unknown as Task;
    renderForm({ initial: task });
    expect(screen.getByLabelText(en.planning.titleLabel)).not.toHaveFocus();
    expect(screen.queryByLabelText(en.planning.statusLabel)).toBeNull();
  });
});
