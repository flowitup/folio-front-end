import { describe, it, expect } from "vitest";
import type { Task } from "@/types/task";
import { groupAgendaTasks } from "@/lib/dashboard/overview-agenda";

// Wednesday, so the week runs Mon 2026-08-03 → Sun 2026-08-09.
const REFERENCE = new Date(2026, 7, 5);

let seq = 0;
function mkTask(partial: Partial<Task>): Task {
  seq += 1;
  return {
    id: `task-${seq}`,
    project_id: "p-1",
    title: `Task ${seq}`,
    description: null,
    status: "todo",
    priority: "medium",
    assignee_id: null,
    due_date: null,
    position: 0,
    labels: [],
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("groupAgendaTasks", () => {
  it("buckets by due date into Overdue / Today / This week", () => {
    const overdue = mkTask({ title: "Overdue task", due_date: "2026-08-01" });
    const today = mkTask({ title: "Today task", due_date: "2026-08-05" });
    const friday = mkTask({ title: "Friday task", due_date: "2026-08-07" });
    const sunday = mkTask({ title: "Sunday task", due_date: "2026-08-09" });

    const groups = groupAgendaTasks([overdue, today, friday, sunday], REFERENCE);

    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "thisWeek"]);
    expect(groups[0].tasks).toEqual([overdue]);
    expect(groups[1].tasks).toEqual([today]);
    expect(groups[2].tasks.map((t) => t.title)).toEqual(["Friday task", "Sunday task"]);
  });

  it("excludes tasks due next week or later", () => {
    const nextMonday = mkTask({ due_date: "2026-08-10" });
    const groups = groupAgendaTasks([nextMonday], REFERENCE);
    expect(groups).toEqual([]);
  });

  it("excludes done tasks and tasks without a due date", () => {
    const done = mkTask({ due_date: "2026-08-05", status: "done" });
    const undated = mkTask({ due_date: null });
    const groups = groupAgendaTasks([done, undated], REFERENCE);
    expect(groups).toEqual([]);
  });

  it("caps total items across groups, dropping This week first", () => {
    const overdue1 = mkTask({ title: "o1", due_date: "2026-08-01" });
    const overdue2 = mkTask({ title: "o2", due_date: "2026-08-02" });
    const friday = mkTask({ title: "f", due_date: "2026-08-07" });
    const sunday = mkTask({ title: "s", due_date: "2026-08-09" });

    const groups = groupAgendaTasks([overdue1, overdue2, friday, sunday], REFERENCE, 3);

    expect(groups.find((g) => g.key === "overdue")?.tasks).toHaveLength(2);
    expect(groups.find((g) => g.key === "thisWeek")?.tasks).toHaveLength(1);
  });

  it("sorts within a group by due date ascending", () => {
    const later = mkTask({ title: "later", due_date: "2026-08-09" });
    const sooner = mkTask({ title: "sooner", due_date: "2026-08-06" });
    const groups = groupAgendaTasks([later, sooner], REFERENCE);
    const thisWeek = groups.find((g) => g.key === "thisWeek")!;
    expect(thisWeek.tasks.map((t) => t.title)).toEqual(["sooner", "later"]);
  });
});
