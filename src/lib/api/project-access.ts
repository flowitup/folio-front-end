/**
 * Server-only: the project a project page is about, with the same access rule
 * as the project layout. Only a refusal (403) or a missing project (404) means
 * "no access" and shows the localized not-found page; an expired session goes
 * to sign-in; any other failure (network, 5xx) is thrown to the error boundary
 * with its retry, instead of silently bouncing a user who has access.
 */

import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api/http";
import { getProjectById } from "@/lib/api/projects-server";
import type { Project } from "@/types/project";

export async function getAccessibleProject(projectId: string, locale: string): Promise<Project> {
  try {
    return await getProjectById(projectId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    if (err instanceof ApiError && err.status === 401) redirect(`/${locale}/login`);
    throw err;
  }
}
