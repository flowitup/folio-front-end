// Planning task (Kanban board) types

export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

// Lanes shown as columns on the board (backlog rendered separately as a top bar).
export const BOARD_COLUMNS: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  due_date: string | null;
  position: number;
  labels: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string | null;
  due_date?: string | null;
  labels?: string[];
}

export type UpdateTaskPayload = Partial<Omit<CreateTaskPayload, "status">>;

export interface MoveTaskPayload {
  status: TaskStatus;
  before_id?: string;
  after_id?: string;
}
