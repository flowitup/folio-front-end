/**
 * Client-side tags API helpers.
 * Uses cookie-based auth (api.get) — safe to call from client components.
 * Server components should use src/lib/api/tags.ts (sessionAuthHeader).
 */

import { api } from "@/lib/api/http";
import type { ProjectTag } from "@/lib/api/tags";

interface TagListResult {
  items: ProjectTag[];
  count: number;
}

export async function fetchTagsClient(projectId: string): Promise<ProjectTag[]> {
  const data = await api.get<TagListResult>(`/projects/${projectId}/tags`);
  return data.items;
}
