/**
 * Server-only project API wrappers
 * Uses next/headers (sessionAuthHeader) — must NOT be imported by client components.
 * Client-side project fetching lives in projects.ts (uses the http.ts client).
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import type { Project } from "@/types/project";

// Minimal project shape for admin use (id + name only)
export interface ProjectSummary {
  id: string;
  name: string;
}

/**
 * List all projects visible to the caller (superadmin sees all).
 * Server-only — relies on next/headers via sessionAuthHeader.
 */
export async function listProjects(): Promise<ProjectSummary[]> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/projects`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching projects: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch projects (HTTP ${response.status})`);
  }
  const data: { projects: ProjectSummary[] } = await response.json();
  return data.projects;
}

/**
 * Fetch a single project by id with the caller's server session.
 *
 * Server components MUST use this (not the cookie-based `fetchProjectById` in
 * projects.ts): a server-side `fetch` does not replay the browser's httpOnly
 * auth cookie, so the client wrapper returns 401 on the server and the project
 * resolves to null — silently disabling owner checks and, on the documents
 * page, redirecting the owner away. Throws on non-2xx so callers can `.catch`.
 */
export async function getProjectById(id: string): Promise<Project> {
  const authHeaders = await sessionAuthHeader();
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/projects/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Network error fetching project: ${String(err)}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch project (HTTP ${response.status})`);
  }
  return (await response.json()) as Project;
}
