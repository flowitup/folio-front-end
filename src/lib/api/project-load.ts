/**
 * Server-side project load for a project page, telling the outcomes apart:
 * the project, "no access / no such project" (403/404), an expired session
 * (401), or any other failure (outage, timeout, 5xx) the page should report
 * with a retry instead of silently redirecting.
 */

import { ApiError } from "@/lib/api/http";
import { getProjectById } from "@/lib/api/projects-server";
import type { Project } from "@/types/project";

export type ProjectLoad =
  | { kind: "ok"; project: Project }
  | { kind: "unauthenticated" }
  | { kind: "notFound" }
  | { kind: "error" };

export function classifyProjectLoadError(err: unknown): Exclude<ProjectLoad, { kind: "ok" }> {
  if (err instanceof ApiError) {
    if (err.status === 401) return { kind: "unauthenticated" };
    if (err.status === 403 || err.status === 404) return { kind: "notFound" };
  }
  return { kind: "error" };
}

export async function loadProjectForPage(projectId: string): Promise<ProjectLoad> {
  try {
    return { kind: "ok", project: await getProjectById(projectId) };
  } catch (err) {
    return classifyProjectLoadError(err);
  }
}
