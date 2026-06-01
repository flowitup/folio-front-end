/**
 * WeekView: groups tasks by due_date into Mon→Sun cells + an Unscheduled
 * bucket, and drives week navigation + per-day add callbacks.
 *
 * System time is pinned to a Wednesday (2026-06-03) so "this week" is the
 * deterministic 2026-06-01 → 2026-06-07 range.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { WeekView } from "@/components/planning/week-view";
import type { Task, TaskStatus, TaskPriority } from "@/types/task";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "t-" + (overrides.id ?? "x"),
    project_id: "p1",
    title: "Task",
    description: null,
    status: "todo" as TaskStatus,
    priority: "medium" as TaskPriority,
    assignee_id: null,
    due_date: null,
    position: 1000,
    labels: [],
    created_by: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function renderWeek(props: Partial<Parameters<typeof WeekView>[0]> & { tasks: Task[] }) {
  const onTaskClick = vi.fn();
  const onWeekOffsetChange = vi.fn();
  const onAddForDate = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WeekView
        weekOffset={0}
        onTaskClick={onTaskClick}
        onWeekOffsetChange={onWeekOffsetChange}
        onAddForDate={onAddForDate}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onTaskClick, onWeekOffsetChange, onAddForDate };
}

describe("WeekView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0)); // Wed 2026-06-03
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("places a dated task on its weekday and an undated task under Unscheduled", () => {
    renderWeek({
      tasks: [
        makeTask({ id: "in", title: "In-week task", due_date: "2026-06-03" }),
        makeTask({ id: "none", title: "Floating task", due_date: null }),
      ],
    });
    expect(screen.getByText("In-week task")).toBeInTheDocument();
    expect(screen.getByText("Floating task")).toBeInTheDocument();
    expect(screen.getByText("Unscheduled")).toBeInTheDocument();
  });

  it("shows the current week range and 'This week' control", () => {
    renderWeek({ tasks: [] });
    expect(screen.getByText("This week")).toBeInTheDocument();
    // Range label for 2026-06-01 → 2026-06-07.
    expect(screen.getByText(/Jun/)).toBeInTheDocument();
  });

  it("clicking a task chip invokes onTaskClick with that task", () => {
    const { onTaskClick } = renderWeek({
      tasks: [makeTask({ id: "in", title: "Clickable", due_date: "2026-06-03" })],
    });
    fireEvent.click(screen.getByText("Clickable"));
    expect(onTaskClick).toHaveBeenCalledTimes(1);
    expect(onTaskClick.mock.calls[0][0].title).toBe("Clickable");
  });

  it("prev / next navigation shifts the week offset", () => {
    const { onWeekOffsetChange } = renderWeek({ tasks: [], weekOffset: 0 });
    fireEvent.click(screen.getByLabelText("Next week"));
    expect(onWeekOffsetChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByLabelText("Previous week"));
    expect(onWeekOffsetChange).toHaveBeenCalledWith(-1);
  });

  it("Unscheduled add button requests a task with no due date", () => {
    const { onAddForDate } = renderWeek({ tasks: [] });
    // Multiple "Add task" buttons (per day + unscheduled); the last is Unscheduled.
    const addButtons = screen.getAllByLabelText("Add task");
    fireEvent.click(addButtons[addButtons.length - 1]);
    expect(onAddForDate).toHaveBeenCalledWith("");
  });
});
