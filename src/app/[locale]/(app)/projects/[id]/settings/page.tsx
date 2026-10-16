import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSession } from "@/lib/auth/session";
import { loadProjectForPage } from "@/lib/api/project-load";
import { ProjectLoadError } from "@/components/projects/project-load-error";
import { ProjectSettingsClient } from "./project-settings-client";
import { pageTitle } from "@/lib/i18n/page-title";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = pageTitle("navigation.projectSettings");

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const locale = await getLocale();

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  // Only "no access / no such project" is a not-found page and an expired
  // session goes to sign-in; an outage or a timeout says so with a retry and
  // keeps the URL, instead of silently landing on the projects list.
  const load = await loadProjectForPage(projectId);
  if (load.kind === "unauthenticated") redirect(`/${locale}/login`);
  if (load.kind === "notFound") notFound();
  if (load.kind === "error") return <ProjectLoadError />;

  return <ProjectSettingsClient project={load.project} />;
}
