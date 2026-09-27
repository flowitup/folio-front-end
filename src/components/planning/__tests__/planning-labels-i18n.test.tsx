/**
 * Planning labels come from the app language: the lane "+" button, the
 * backlog "+", the priority dots and the drawer's close button used to be
 * English literals or raw enum values.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { DndContext } from "@dnd-kit/core";
import frMessages from "@/messages/fr.json";
import viMessages from "@/messages/vi.json";
import { KanbanColumn } from "../kanban-column";
import { BacklogBar } from "../backlog-bar";
import type { Task } from "@/types/task";

function mkTask(partial: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    project_id: "p-1",
    title: "Coffrage",
    description: null,
    status: "todo",
    priority: "high",
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

function wrap(ui: React.ReactNode, messages: Record<string, unknown>, locale: string) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <DndContext>{ui}</DndContext>
    </NextIntlClientProvider>
  );
}

describe("planning labels", () => {
  it("names the lane add button and the priority dot in French", () => {
    wrap(
      <KanbanColumn status="todo" title="À faire" tasks={[mkTask()]} onAdd={vi.fn()} onTaskClick={vi.fn()} />,
      frMessages,
      "fr"
    );
    expect(screen.getByRole("button", { name: "Ajouter une tâche" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Haute" })).toHaveAttribute("title", "Haute");
  });

  it("names the backlog add button and uses Vietnamese words, not 'task'", () => {
    wrap(
      <BacklogBar tasks={[mkTask({ status: "backlog", priority: "urgent" })]} onAdd={vi.fn()} onTaskClick={vi.fn()} />,
      viMessages,
      "vi"
    );
    expect(screen.getByRole("button", { name: "Thêm công việc" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Khẩn cấp" })).toBeInTheDocument();
    expect(screen.queryByText(/\bBacklog\b/)).toBeNull();
    const planning = (viMessages as { planning: Record<string, unknown> }).planning;
    const flat = JSON.stringify(planning);
    expect(flat).not.toMatch(/\btask\b/i);
  });
});

describe("task card with long text", () => {
  it("keeps a long label and title inside the card", () => {
    const long = "x".repeat(300);
    wrap(
      <KanbanColumn
        status="todo"
        title="À faire"
        tasks={[mkTask({ title: long, labels: [long] })]}
        onTaskClick={vi.fn()}
      />,
      frMessages,
      "fr"
    );
    const label = screen.getByTitle(long);
    expect(label.className).toMatch(/max-w-full/);
    expect(label.className).toMatch(/truncate/);
    expect(screen.getByText(long, { selector: "p" }).className).toMatch(/overflow-wrap:anywhere/);
  });
});
