/**
 * Server-only project API wrappers
 * Uses next/headers (sessionAuthHeader) — must NOT be imported by client components.
 * Client-side project fetching lives in projects.ts (uses the http.ts client).
 */

import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";

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
