import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { sessionAuthHeader } from "@/lib/api/auth-header";
import { ProjectSettingsClient } from "./project-settings-client";
import type { Project } from "@/types/project";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function fetchProject(projectId: string): Promise<Project | null> {
  const authHeaders = await sessionAuthHeader();
  try {
    const res = await fetch(`${env.apiBaseUrl}/projects/${projectId}`, {
      headers: { "Content-Type": "application/json", ...authHeaders },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as Project;
  } catch {
    return null;
  }
}

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const project = await fetchProject(projectId);
  if (!project) {
    redirect(`/${locale}/projects`);
  }

  return <ProjectSettingsClient project={project} />;
}
