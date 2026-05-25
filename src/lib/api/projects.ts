import type { Project, ProjectListResponse, ProjectUsersResponse } from "@/types/project";
import { api } from "@/lib/api/http";

export async function fetchProjects(): Promise<Project[]> {
  const data = await api.get<ProjectListResponse>("/projects");
  return data.projects;
}

export interface CreateProjectPayload {
  name: string;
  address?: string | null;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  return api.post<Project, CreateProjectPayload>("/projects", payload);
}

export interface UpdateProjectPayload {
  name?: string;
  address?: string | null;
  invoice_prefix?: string | null;
}

export async function updateProject(
  id: string,
  payload: UpdateProjectPayload,
): Promise<Project> {
  return api.put<Project, UpdateProjectPayload>(`/projects/${id}`, payload);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function fetchProjectById(id: string): Promise<Project> {
  return api.get<Project>(`/projects/${id}`);
}

export async function fetchProjectUsers(projectId: string): Promise<ProjectUsersResponse> {
  return api.get<ProjectUsersResponse>(`/projects/${projectId}/users`);
}

export async function searchUsers(query: string): Promise<{ users: { id: string; email: string }[]; total: number }> {
  return api.get(`/users?q=${encodeURIComponent(query)}`);
}

export async function addUserToProject(projectId: string, userId: string): Promise<void> {
  await api.post(`/projects/${projectId}/users`, { user_id: userId });
}

export async function removeUserFromProject(projectId: string, userId: string): Promise<void> {
  await api.delete(`/projects/${projectId}/users/${userId}`);
}
