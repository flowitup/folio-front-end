import type { Project, ProjectListResponse } from "@/types/project";
import { api } from "@/lib/api/http";

export async function fetchProjects(): Promise<Project[]> {
  const data = await api.get<ProjectListResponse>("/projects");
  return data.projects;
}

export async function fetchProjectById(id: string): Promise<Project> {
  return api.get<Project>(`/projects/${id}`);
}
