import { api } from "@/lib/api/http";
import type { Task, CreateTaskPayload, UpdateTaskPayload, MoveTaskPayload, TaskStatus } from "@/types/task";

export const fetchTasks = (projectId: string, status?: TaskStatus): Promise<Task[]> =>
  api
    .get<{ tasks: Task[]; total: number }>(
      `/projects/${projectId}/tasks${status ? `?status=${status}` : ""}`
    )
    .then((r) => r.tasks);

export const fetchTask = (taskId: string): Promise<Task> =>
  api.get<Task>(`/tasks/${taskId}`);

export const createTask = (projectId: string, payload: CreateTaskPayload): Promise<Task> =>
  api.post<Task, CreateTaskPayload>(`/projects/${projectId}/tasks`, payload);

export const updateTask = (taskId: string, payload: UpdateTaskPayload): Promise<Task> =>
  api.put<Task, UpdateTaskPayload>(`/tasks/${taskId}`, payload);

export const moveTask = (taskId: string, payload: MoveTaskPayload): Promise<Task> =>
  api.patch<Task, MoveTaskPayload>(`/tasks/${taskId}/move`, payload);

export const deleteTask = (taskId: string): Promise<void> =>
  api.delete<void>(`/tasks/${taskId}`);
